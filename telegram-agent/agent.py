import os
import json
import sqlite3
from datetime import datetime
from dotenv import load_dotenv
from litellm import completion
from contextlib import closing
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

import logging
import certifi

# Fix for PyInstaller SSL
os.environ['SSL_CERT_FILE'] = certifi.where()

logging.basicConfig(
    filename=os.path.expanduser('~/Library/Application Support/com.hoangtat.cam-do-55/agent.log'),
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load env
load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
ADMIN_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
MODEL_NAME = os.getenv("LLM_MODEL", "gpt-4o-mini")
DB_PATH = os.path.expanduser('~/Library/Application Support/com.hoangtat.cam-do-55/cd_app.db')

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=20.0) # wait if locked
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    return conn

# --- BUSINESS LOGIC ---
def calculate_days(start_date_str: str, to_date=None):
    if to_date is None:
        to_date = datetime.now()
    start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
    d1 = datetime(to_date.year, to_date.month, to_date.day)
    d2 = datetime(start_date.year, start_date.month, start_date.day)
    days = (d1 - d2).days
    
    if days == 0:
        return 2
    elif days > 0:
        return days + 1
    return 0

def calculate_profit(amount, rate, days):
    return (days * amount * rate) / 1000000

# --- TOOLS FOR LLM ---

def get_contracts_by_customer(query: str):
    """
    Tra cứu hợp đồng theo tên khách hàng hoặc số điện thoại.
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT c.*, cus.name as customer_name, cus.phone as customer_phone, cus.debt as customer_debt
            FROM contracts c
            JOIN customers cus ON c.customer_id = cus.id
            WHERE cus.name LIKE ? OR cus.phone LIKE ?
        ''', (f'%{query}%', f'%{query}%'))
        rows = cursor.fetchall()
    
    if not rows:
        return "Không tìm thấy hợp đồng nào cho khách hàng này."
        
    results = []
    for row in rows:
        r = dict(row)
        days = calculate_days(r['start_date'])
        interest = calculate_profit(r['amount'], r['interest_rate'], days)
        r['current_days'] = days
        r['expected_interest'] = interest
        results.append(r)
        
    return json.dumps(results, ensure_ascii=False)

def auto_calc_renew(contract_id: str, amount_paid: float):
    """
    Gợi ý tính toán khi khách đóng lãi. 
    Trả về số tiền lãi dự kiến, tiền dư/thiếu, và các lựa chọn Tái ký.
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM contracts WHERE id = ?', (contract_id,))
        row = cursor.fetchone()
    
    if not row:
        return "Không tìm thấy hợp đồng."
        
    c = dict(row)
    days = calculate_days(c['start_date'])
    interest = calculate_profit(c['amount'], c['interest_rate'], days)
    diff = amount_paid - interest
    
    result = {
        "expected_interest": interest,
        "amount_paid": amount_paid,
        "diff": diff,
        "suggestions": []
    }
    
    if diff == 0:
        result["suggestions"].append({"action": "match", "new_amount": c['amount'], "desc": "Đóng đủ lãi, giữ nguyên gốc."})
    elif diff > 0:
        result["suggestions"].append({"action": "decrease_principal", "new_amount": c['amount'] - diff, "desc": f"Đóng dư {diff}, bớt nợ gốc."})
    else:
        result["suggestions"].append({"action": "increase_principal", "new_amount": c['amount'] + abs(diff), "desc": f"Đóng thiếu {abs(diff)}, lãi nhập gốc."})
        result["suggestions"].append({"action": "debt", "new_amount": c['amount'], "diff": diff, "desc": f"Ghi nợ tồn {abs(diff)}, giữ nguyên gốc."})
        
    return json.dumps(result, ensure_ascii=False)

def execute_renew_action(contract_id: str, action_type: str, new_amount: float, diff: float = 0):
    """
    Thực hiện hành động tái ký (Tương đương action trên Desktop).
    action_type: 'match' | 'decrease_principal' | 'increase_principal' | 'debt'
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN EXCLUSIVE TRANSACTION")
        try:
            cursor.execute('SELECT * FROM contracts WHERE id = ?', (contract_id,))
            row = cursor.fetchone()
            if not row:
                return "Lỗi: Không tìm thấy hợp đồng."
                
            c = dict(row)
            today = datetime.now().strftime('%Y-%m-%d')
            
            # Update old contract
            cursor.execute("UPDATE contracts SET status = 'Đã xong', last_paid_date = ? WHERE id = ?", (today, contract_id))
            
            # Create new contract
            new_id = f"HDCD-{datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}"
            cursor.execute(
                "INSERT INTO contracts (id, customer_id, amount, asset, interest_rate, start_date, status) VALUES (?, ?, ?, ?, ?, ?, 'Đang chờ')",
                (new_id, c['customer_id'], new_amount, c['asset'], c['interest_rate'], today)
            )
            
            # Handle debt
            if action_type == 'debt' and diff < 0:
                cursor.execute("SELECT debt FROM customers WHERE id = ?", (c['customer_id'],))
                cus = cursor.fetchone()
                current_debt = cus['debt'] if cus and cus['debt'] else 0
                new_debt = current_debt + abs(diff)
                cursor.execute("UPDATE customers SET debt = ? WHERE id = ?", (new_debt, c['customer_id']))
                
            conn.commit()
            return f"Thành công! Đã tất toán hợp đồng cũ {contract_id} và tạo hợp đồng Tái ký mới {new_id} với nợ gốc: {new_amount} VND."
        except Exception as e:
            conn.rollback()
            return f"Lỗi hệ thống: {str(e)}"

def close_contract(contract_id: str):
    """
    Tất toán hợp đồng (Khách chuộc đồ).
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN EXCLUSIVE TRANSACTION")
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            cursor.execute("UPDATE contracts SET status = 'Đã xong', last_paid_date = ? WHERE id = ?", (today, contract_id))
            conn.commit()
            return f"Thành công! Hợp đồng {contract_id} đã được tất toán (khách chuộc đồ)."
        except Exception as e:
            conn.rollback()
            return f"Lỗi hệ thống: {str(e)}"

def liquidate_contract(contract_id: str):
    """
    Chuyển hợp đồng sang trạng thái Thanh lý.
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN EXCLUSIVE TRANSACTION")
        try:
            cursor.execute('SELECT asset, amount FROM contracts WHERE id = ?', (contract_id,))
            row = cursor.fetchone()
            if not row:
                return "Lỗi: Không tìm thấy hợp đồng."
            
            cursor.execute("UPDATE contracts SET status = 'Thanh Lý' WHERE id = ?", (contract_id,))
            cursor.execute(
                "INSERT INTO liquidations (contract_id, asset, loan_amount, status) VALUES (?, ?, ?, 'Đang thanh lý')",
                (contract_id, row['asset'], row['amount'])
            )
            conn.commit()
            return f"Đã chuyển hợp đồng {contract_id} sang khu vực chờ Thanh Lý."
        except Exception as e:
            conn.rollback()
            return f"Lỗi hệ thống: {str(e)}"

def get_contracts_status(status_filter: str = None):
    """
    Tra cứu hợp đồng theo các trạng thái: Đang vay (tất cả chưa tất toán), Đã xong, Thanh lý, Sắp đến hạn, Đến hạn, Quá hạn.
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        base_query = "SELECT c.*, cus.name as customer_name, cus.phone as customer_phone FROM contracts c JOIN customers cus ON c.customer_id = cus.id"
        
        if status_filter and status_filter.lower() == 'đã xong':
            cursor.execute(f"{base_query} WHERE c.status = 'Đã xong'")
        elif status_filter and status_filter.lower() == 'thanh lý':
            cursor.execute(f"{base_query} WHERE c.status IN ('Thanh Lý', 'Thanh lý')")
        else: # Đang vay or specific alert_status
            cursor.execute(f"{base_query} WHERE c.status NOT IN ('Đã xong', 'Thanh Lý', 'Thanh lý')")
            
        rows = cursor.fetchall()
    
    results = []
    total_amount = 0
    
    for row in rows:
        r = dict(row)
        days = calculate_days(r['start_date'])
        interest = calculate_profit(r['amount'], r['interest_rate'], days)
        r['current_days'] = days
        r['expected_interest'] = interest
        
        is_the_chap = r['asset'] and 'Tín chấp' not in r['asset']
        
        if r['status'] in ('Đã xong', 'Thanh Lý', 'Thanh lý'):
            r['alert_status'] = r['status']
        elif days >= 39 and is_the_chap:
            r['alert_status'] = 'Thanh lý'
        elif days >= 31:
            r['alert_status'] = 'Quá hạn'
        elif days == 30:
            r['alert_status'] = 'Đến hạn'
        elif days >= 26:
            r['alert_status'] = 'Sắp đến hạn'
        else:
            r['alert_status'] = 'Bình thường'
            
        # Lọc theo status_filter
        if status_filter:
            sf = status_filter.lower()
            if sf == 'đang vay' or sf == 'tất cả':
                if r['status'] in ('Đã xong', 'Thanh Lý', 'Thanh lý'):
                    continue
            elif sf == 'đã xong':
                if r['status'] != 'Đã xong': continue
            elif sf == 'thanh lý':
                if r['status'] not in ('Thanh Lý', 'Thanh lý') and r['alert_status'] != 'Thanh lý': continue
            elif sf == 'đang chờ':
                if r['status'].lower() != 'đang chờ': continue
            elif sf in ('sắp đến hạn', 'đến hạn', 'quá hạn', 'bình thường'):
                if r['alert_status'].lower() != sf:
                    continue
                    
        results.append(r)
        total_amount += r['amount']
        
    order = {'Quá hạn': 1, 'Thanh lý': 2, 'Đến hạn': 3, 'Sắp đến hạn': 4, 'Bình thường': 5, 'Đã xong': 6}
    results.sort(key=lambda x: order.get(x.get('alert_status', 'Bình thường'), 99))
    
    summary = {
        "status_requested": status_filter or "Tất cả",
        "total_count": len(results),
        "total_amount": total_amount,
        "contracts": results[:30] # Limit to 30 to avoid token limits
    }
    
    return json.dumps(summary, ensure_ascii=False)

def create_contract(customer_name: str, amount: float, start_date: str = None, interest_rate: float = 2000):
    """
    Tạo hợp đồng mới cho khách hàng.
    Nếu ngày vay (start_date) không có, lấy ngày hiện tại.
    Nếu lãi suất (interest_rate) không có, mặc định là 2000 (1 triệu 1 ngày 2000).
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute("BEGIN EXCLUSIVE TRANSACTION")
        try:
            if not start_date:
                start_date = datetime.now().strftime('%Y-%m-%d')
                
            # Tìm khách hàng theo tên
            cursor.execute("SELECT id FROM customers WHERE name LIKE ?", (f'%{customer_name}%',))
            row = cursor.fetchone()
            
            if row:
                customer_id = row['id']
            else:
                # Nếu chưa có, tạo khách hàng mới với số điện thoại ngẫu nhiên để tránh lỗi UNIQUE
                import random
                fake_phone = f"099{random.randint(1000000, 9999999)}"
                cursor.execute("INSERT INTO customers (name, phone) VALUES (?, ?)", (customer_name, fake_phone))
                customer_id = cursor.lastrowid
                
            # Tạo hợp đồng
            new_id = f"HDCD-{datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}"
            cursor.execute(
                "INSERT INTO contracts (id, customer_id, amount, asset, interest_rate, start_date, status) VALUES (?, ?, ?, ?, ?, ?, 'Đang chờ')",
                (new_id, customer_id, amount, "Tín chấp", interest_rate, start_date)
            )
            conn.commit()
            return f"Đã tạo hợp đồng thành công! Mã HĐ: {new_id}, Khách: {customer_name}, Số tiền: {amount:,} VND, Ngày: {start_date}, Lãi: {interest_rate}đ/1tr/ngày."
        except Exception as e:
            conn.rollback()
            return f"Lỗi hệ thống: {str(e)}"

# --- LITELLM TOOL DEFINITIONS ---
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_contracts_by_customer",
            "description": "Tra cứu hợp đồng theo tên khách hàng hoặc số điện thoại.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Tên hoặc SĐT của khách hàng."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_contracts_status",
            "description": "Tra cứu, thống kê số lượng và danh sách hợp đồng theo các tình trạng (Đang vay, Đã xong, Thanh lý...). Trả về tổng số hợp đồng, tổng tiền và danh sách.",
            "parameters": {
                "type": "object",
                "properties": {
                    "status_filter": {
                        "type": "string",
                        "description": "BẮT BUỘC chọn 1 trong: 'Đang vay' (tất cả HĐ đang cầm), 'Đang chờ' (trạng thái bình thường), 'Đã xong' (đã tất toán), 'Thanh lý', 'Quá hạn', 'Đến hạn', 'Sắp đến hạn'."
                    }
                },
                "required": ["status_filter"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "auto_calc_renew",
            "description": "Trợ lý tính toán khi khách đóng tiền lãi. Đưa vào mã hợp đồng và số tiền khách đóng, hàm sẽ tự tính toán lãi thực tế và gợi ý các tác vụ như Lãi nhập gốc, Ghi nợ tồn, Giảm nợ gốc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_id": {"type": "string", "description": "Mã hợp đồng (HDCD-...)"},
                    "amount_paid": {"type": "number", "description": "Số tiền khách đóng (VNĐ)."}
                },
                "required": ["contract_id", "amount_paid"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_renew_action",
            "description": "Thực hiện thao tác tái ký/đóng lãi (Lãi nhập gốc, Ghi nợ tồn, Giảm nợ gốc, hoặc Đóng đủ lãi) sau khi Đại ca đã chọn phương án từ hàm auto_calc_renew.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_id": {"type": "string", "description": "Mã hợp đồng cũ đang vay"},
                    "action_type": {"type": "string", "enum": ["match", "decrease_principal", "increase_principal", "debt"], "description": "match (Đủ lãi), decrease_principal (Giảm nợ gốc), increase_principal (Lãi nhập gốc), debt (Ghi nợ tồn)"},
                    "new_amount": {"type": "number", "description": "Số nợ gốc của hợp đồng Tái ký mới."},
                    "diff": {"type": "number", "description": "Số dư hoặc thiếu (số âm nếu thiếu). Cần thiết để ghi nợ tồn."}
                },
                "required": ["contract_id", "action_type", "new_amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "close_contract",
            "description": "Tất toán toàn bộ hợp đồng, trả đồ cho khách (chỉ làm việc này nếu khách yêu cầu chuộc đồ/tất toán).",
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_id": {"type": "string"}
                },
                "required": ["contract_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "liquidate_contract",
            "description": "Đưa hợp đồng vào danh sách thanh lý tài sản.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_id": {"type": "string"}
                },
                "required": ["contract_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_contract",
            "description": "Tạo hợp đồng cầm đồ mới cho khách hàng.",
            "parameters": {
                "type": "object",
                "properties": {
                    "customer_name": {"type": "string", "description": "Tên khách hàng"},
                    "amount": {"type": "number", "description": "Số tiền vay"},
                    "start_date": {"type": "string", "description": "Ngày vay (YYYY-MM-DD). Nếu không có, bỏ trống."},
                    "interest_rate": {"type": "number", "description": "Lãi suất (số tiền/1 triệu/1 ngày). Nếu không có, bỏ trống."}
                },
                "required": ["customer_name", "amount"]
            }
        }
    }
]

available_functions = {
    "get_contracts_by_customer": get_contracts_by_customer,
    "auto_calc_renew": auto_calc_renew,
    "execute_renew_action": execute_renew_action,
    "close_contract": close_contract,
    "liquidate_contract": liquidate_contract,
    "get_contracts_status": get_contracts_status,
    "create_contract": create_contract,
}

SYSTEM_PROMPT = """Bạn là trợ lý AI quản lý tiệm Cầm Đồ 55. Bạn có thể tra cứu hợp đồng, tính toán tiền lãi, tái ký, đóng lãi, tất toán, tạo hợp đồng mới và thanh lý.
Mọi phân tích ngôn ngữ tự nhiên của bạn cần được map chính xác với các Function Tool.

1. TRA CỨU HỢP ĐỒNG:
- Khi hỏi "Có bao nhiêu hợp đồng đang vay?", "Danh sách đang vay": Gọi `get_contracts_status` với `status_filter="Đang vay"`. Bạn sẽ nhận được tổng số lượng (`total_count`), tổng tiền (`total_amount`), và danh sách.
- Khi hỏi "Hợp đồng đã xong", "Tất toán": Gọi `get_contracts_status` với `status_filter="Đã xong"`.
- Khi hỏi "Hợp đồng thanh lý": Gọi `get_contracts_status` với `status_filter="Thanh lý"`.
- Khi hỏi "Hợp đồng đang chờ", "Trạng thái đang chờ": Gọi `get_contracts_status` với `status_filter="Đang chờ"`.
- Khi tra cứu rủi ro: Dùng `status_filter="Quá hạn"`, "Đến hạn", "Sắp đến hạn".
Lưu ý: Chỉ in ra thông tin dựa trên kết quả trả về. Luôn hiển thị tổng số lượng và tổng tiền ở đầu danh sách (định dạng số tiền có dấu phẩy cho dễ đọc).

2. ĐÓNG LÃI & TÁI KÝ (TRỢ LÝ TÍNH TOÁN):
Khi Đại ca đưa thông tin khách đóng tiền (VD: "Khách hợp đồng HDCD-xxx đóng 500k"):
- Bước 1: Gọi `auto_calc_renew` với `contract_id` và `amount_paid`. Tool sẽ tự tính toán tiền lãi thực tế và đưa ra các tác vụ tương ứng (lãi nhập gốc, ghi nợ tồn, giảm nợ gốc...).
- Bước 2: Hiển thị RÕ RÀNG các phương án (Action) cho Đại ca chọn. (Ví dụ: "Phương án 1: Lãi nhập gốc (tăng gốc) | Phương án 2: Ghi nợ tồn").
- Bước 3: Đợi Đại ca chọn phương án.
- Bước 4: Gọi `execute_renew_action` với `action_type` tương ứng.

3. TẠO MỚI / TẤT TOÁN / THANH LÝ:
- Tạo mới: Gọi `create_contract`. Mặc định "Tín chấp", lãi 2000đ nếu không có thông tin.
- Tất toán: Gọi `close_contract` khi khách chuộc đồ và kết thúc hợp đồng.
- Thanh lý: Gọi `liquidate_contract` để đưa vào kho thanh lý.

QUY TẮC HIỂN THỊ (BẮT BUỘC):
1. Danh sách hợp đồng (luôn format đẹp mắt):
📊 DANH SÁCH HỢP ĐỒNG: {status_requested}
Tổng cộng: {total_count} hợp đồng | Tổng tiền: {total_amount}đ

━━━━━━━━━━━━━━━━━━
📄 Mã: {contract_id}
👤 {customer_name} - 📱 {customer_phone}
💰 {amount}đ
📅 {current_days} ngày | 💵 Lãi dự kiến: {expected_interest}đ | {alert_status}
📌 Trạng thái: {status}
━━━━━━━━━━━━━━━━━━

2. Báo cáo thành công (Tạo mới, Tất toán, Tái ký):
✅ ĐÃ THỰC HIỆN THÀNH CÔNG
━━━━━━━━━━━━━━━━━━
📄 Mã HĐ: {contract_id}
... (Liệt kê các thông tin quan trọng)

Luôn xưng "Em" và gọi "Đại ca". Dí dỏm, vui vẻ nhưng chốt số liệu phải CHUẨN XÁC 100%. Không tự bịa data, thiếu thì bảo thiếu."""

messages_memory = {}

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    if not is_authorized(chat_id):
        await update.message.reply_text("⛔️ Xin lỗi, bạn không có quyền truy cập hệ thống quản lý Cầm Đồ 55.")
        return

    user_id = update.message.from_user.id
    user_msg = update.message.text
    logger.info(f"Received message from {user_id}: {user_msg}")
    
    # Tính toán ngày giờ hiện tại để tiêm vào não LLM
    current_time_str = datetime.now().strftime('%H:%M:%S ngày %d/%m/%Y')
    dynamic_system_prompt = SYSTEM_PROMPT + f"\n\n[HỆ THỐNG]: Bây giờ đang là {current_time_str}. Hãy dùng thời gian này nếu Đại ca hỏi về ngày giờ hiện tại."
    
    if user_id not in messages_memory:
        messages_memory[user_id] = [{"role": "system", "content": dynamic_system_prompt}]
    else:
        # Cập nhật thời gian mới nhất vào System Prompt
        if messages_memory[user_id] and messages_memory[user_id][0].get("role") == "system":
            messages_memory[user_id][0]["content"] = dynamic_system_prompt
        
    messages_memory[user_id].append({"role": "user", "content": user_msg})
    
    # Call LiteLLM
    try:
        logger.info("Calling LiteLLM...")
        response = completion(
            model=MODEL_NAME,
            messages=messages_memory[user_id],
            tools=tools,
            tool_choice="auto"
        )
    except Exception as e:
        logger.error(f"LiteLLM error: {e}")
        await update.message.reply_text(f"Lỗi khi gọi AI: {str(e)}")
        return
    
    response_message = response.choices[0].message
    messages_memory[user_id].append(response_message)
    
    tool_calls = getattr(response_message, 'tool_calls', None)
    
    if tool_calls:
        logger.info(f"LLM used tools: {len(tool_calls)}")
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            function_args = json.loads(tool_call.function.arguments)
            
            # Execute function
            func = available_functions.get(function_name)
            if func:
                try:
                    logger.info(f"Executing {function_name} with args: {function_args}")
                    result = func(**function_args)
                    logger.info(f"Result from {function_name}: {result}")
                except Exception as e:
                    logger.error(f"Error executing {function_name}: {e}")
                    result = f"Error: {e}"
                    result = f"Error executing {function_name}: {str(e)}"
                    
                messages_memory[user_id].append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": str(result)
                })
                
        # Call LLM again with function results
        try:
            second_response = completion(
                model=MODEL_NAME,
                messages=messages_memory[user_id]
            )
            final_answer = second_response.choices[0].message.content
            messages_memory[user_id].append(second_response.choices[0].message)
            logger.info(f"Sending reply after tools: {final_answer}")
            await update.message.reply_text(final_answer)
        except Exception as e:
            await update.message.reply_text(f"Lỗi xử lý LLM Step 2: {str(e)}")
    else:
        logger.info(f"Sending reply: {response_message.content}")
        await update.message.reply_text(response_message.content)

ADMIN_CHAT_ID_FILE = os.path.expanduser('~/Library/Application Support/com.hoangtat.cam-do-55/admin_chat_id.txt')

def save_admin_chat_id(chat_id):
    with open(ADMIN_CHAT_ID_FILE, 'w') as f:
        f.write(str(chat_id))

def get_admin_chat_id():
    if os.path.exists(ADMIN_CHAT_ID_FILE):
        with open(ADMIN_CHAT_ID_FILE, 'r') as f:
            return f.read().strip()
    return None

import asyncio

async def check_contracts_loop(app: Application):
    notified_date = None
    notified_slots = set()
    
    while True:
        chat_id = ADMIN_CHAT_ID
        if not chat_id:
            await asyncio.sleep(60)
            continue
            
        now = datetime.now()
        today_date = now.strftime('%Y-%m-%d')
        
        if notified_date != today_date:
            notified_date = today_date
            notified_slots.clear()
            
        current_time = now.strftime('%H:%M')
        current_slot = None
        
        # Xác định khung giờ
        if "07:30" <= current_time <= "08:00":
            current_slot = "morning"
        elif "13:30" <= current_time <= "14:00":
            current_slot = "afternoon"
        elif "18:30" <= current_time <= "19:00":
            current_slot = "evening"
            
        if current_slot and current_slot not in notified_slots:
            try:
                conn = get_db()
                cursor = conn.cursor()
                cursor.execute("SELECT c.*, cus.name as customer_name, cus.phone as customer_phone FROM contracts c JOIN customers cus ON c.customer_id = cus.id WHERE c.status NOT IN ('Đã xong', 'Thanh Lý')")
                rows = cursor.fetchall()
                conn.close()
                
                sap_den_han = []
                den_han = []
                qua_han = []
                
                for row in rows:
                    r = dict(row)
                    days = calculate_days(r['start_date'])
                    is_the_chap = r['asset'] and 'Tín chấp' not in r['asset']
                    
                    msg = f"  • Khách {r['customer_name']} | Vay {r['amount']:,}đ | {days} ngày"
                    
                    if days >= 39 and is_the_chap:
                        qua_han.append(msg + " (Thanh lý)")
                    elif days >= 31:
                        qua_han.append(msg)
                    elif days == 30:
                        den_han.append(msg)
                    elif 26 <= days <= 29:
                        sap_den_han.append(msg)
                
                if sap_den_han or den_han or qua_han:
                    final_msg = f"🔔 *BÁO CÁO HỢP ĐỒNG - {current_time}*\n━━━━━━━━━━━━━━━━━━\n"
                    
                    if den_han:
                        final_msg += f"\n🚨 *HÔM NAY ĐẾN HẠN* ({len(den_han)})\n"
                        final_msg += "\n".join(den_han[:5])
                        if len(den_han) > 5:
                            final_msg += f"\n  ... và {len(den_han) - 5} hợp đồng khác."
                            
                    if qua_han:
                        final_msg += f"\n\n⚠️ *ĐÃ QUÁ HẠN* ({len(qua_han)})\n"
                        final_msg += "\n".join(qua_han[:5])
                        if len(qua_han) > 5:
                            final_msg += f"\n  ... và {len(qua_han) - 5} hợp đồng khác."
                            
                    if sap_den_han:
                        final_msg += f"\n\n⏳ *SẮP TỚI HẠN* ({len(sap_den_han)})\n"
                        final_msg += "\n".join(sap_den_han[:5])
                        if len(sap_den_han) > 5:
                            final_msg += f"\n  ... và {len(sap_den_han) - 5} hợp đồng khác."
                            
                    await app.bot.send_message(chat_id=chat_id, text=final_msg, parse_mode='Markdown')
                    notified_slots.add(current_slot)
                    logger.info(f"Sent {current_slot} notification.")
            except Exception as e:
                logger.error(f"Error checking contracts loop: {e}")
                
        # Check every 60 seconds để không miss phút 30
        await asyncio.sleep(60)

async def watch_parent_process():
    import os
    import sys
    while True:
        if os.getppid() == 1:
            logger.info("Parent process died (orphaned). Exiting to prevent zombie...")
            os._exit(0)
        await asyncio.sleep(2)

async def post_init(application: Application):
    asyncio.create_task(check_contracts_loop(application))
    asyncio.create_task(watch_parent_process())

def is_authorized(chat_id: str) -> bool:
    if not ADMIN_CHAT_ID:
        return False
    return str(chat_id) == ADMIN_CHAT_ID

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = str(update.message.chat_id)
    
    if not is_authorized(chat_id):
        await update.message.reply_text("⛔️ Xin lỗi, bạn không có quyền truy cập hệ thống quản lý Cầm Đồ 55.")
        return
        
    await update.message.reply_text("Chào đại ca! Em là Trợ lý Cầm Đồ 55. Đại ca cần em tra cứu hay xử lý hợp đồng nào ạ?")

import fcntl
import sys

def acquire_single_instance_lock():
    global _lock_file
    import os
    import time
    lock_path = os.path.expanduser('~/Library/Application Support/com.hoangtat.cam-do-55/agent.lock')
    os.makedirs(os.path.dirname(lock_path), exist_ok=True)
    _lock_file = open(lock_path, 'w')
    
    max_retries = 10
    for i in range(max_retries):
        try:
            fcntl.flock(_lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return
        except IOError:
            if i < max_retries - 1:
                logger.info(f"Lock is busy, retrying in 1s... ({i+1}/{max_retries})")
                time.sleep(1)
            else:
                logger.info("Another instance is already running (locked). Exiting.")
                print("Another instance is already running. Exiting.")
                sys.exit(0)

def main():
    acquire_single_instance_lock()
    
    logger.info("Agent script started")
    if not TELEGRAM_BOT_TOKEN:
        logger.error("Cảnh báo: Chưa cài đặt TELEGRAM_BOT_TOKEN trong file .env!")
        print("Cảnh báo: Chưa cài đặt TELEGRAM_BOT_TOKEN trong file .env!")
        return

    logger.info("Initializing Application builder...")
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).post_init(post_init).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    print("AI Telegram Agent đang chạy...")
    logger.info("Application starting polling...")
    application.run_polling()

if __name__ == '__main__':
    main()
