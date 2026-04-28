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
    Tra cứu hợp đồng theo tình trạng (sắp đến hạn, quá hạn).
    Một hợp đồng có thời hạn mặc định là 30 ngày.
    """
    with closing(get_db()) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT c.*, cus.name as customer_name, cus.phone as customer_phone FROM contracts c JOIN customers cus ON c.customer_id = cus.id WHERE c.status NOT IN ('Đã xong', 'Thanh Lý')")
        rows = cursor.fetchall()
    
    results = []
    for row in rows:
        r = dict(row)
        days = calculate_days(r['start_date'])
        interest = calculate_profit(r['amount'], r['interest_rate'], days)
        r['current_days'] = days
        r['expected_interest'] = interest
        
        is_the_chap = r['asset'] and 'Tín chấp' not in r['asset']
        
        if days >= 39 and is_the_chap:
            r['alert_status'] = 'Thanh lý'
        elif days >= 31:
            r['alert_status'] = 'Quá hạn'
        elif days == 30:
            r['alert_status'] = 'Đến hạn'
        elif days >= 26:
            r['alert_status'] = 'Sắp đến hạn'
        else:
            r['alert_status'] = 'Bình thường'
            
        # Nếu có status_filter, chỉ giữ lại những thằng khớp
        if status_filter and status_filter.lower() != 'tất cả':
            if r['alert_status'].lower() != status_filter.lower():
                continue
        # Bỏ qua các hợp đồng 'Bình thường' để tránh quá tải token của LLM
        elif r['alert_status'] == 'Bình thường':
            continue
            
        results.append(r)
        
    # Sắp xếp kết quả: Quá hạn -> Đến hạn -> Sắp đến hạn -> Thanh lý
    # Để khi trả về LLM, những cái quan trọng (Quá hạn) nằm trên cùng
    order = {'Quá hạn': 1, 'Thanh lý': 2, 'Đến hạn': 3, 'Sắp đến hạn': 4, 'Bình thường': 5}
    results.sort(key=lambda x: order.get(x['alert_status'], 99))
    
    return json.dumps(results, ensure_ascii=False)

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
            "description": "Tìm kiếm hợp đồng của khách hàng bằng tên hoặc số điện thoại.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Tên hoặc SĐT của khách."}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "auto_calc_renew",
            "description": "Tính toán tiền lãi và gợi ý tái ký dựa trên số tiền khách đóng.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_id": {"type": "string", "description": "Mã hợp đồng (HDCD-...)"},
                    "amount_paid": {"type": "number", "description": "Số tiền khách trả."}
                },
                "required": ["contract_id", "amount_paid"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "execute_renew_action",
            "description": "Thực hiện thao tác tái ký hợp đồng sau khi đã chọn được action_type phù hợp.",
            "parameters": {
                "type": "object",
                "properties": {
                    "contract_id": {"type": "string", "description": "Mã hợp đồng cũ"},
                    "action_type": {"type": "string", "enum": ["match", "decrease_principal", "increase_principal", "debt"]},
                    "new_amount": {"type": "number", "description": "Số nợ gốc của hợp đồng mới"},
                    "diff": {"type": "number", "description": "Số tiền dư hoặc thiếu (âm nếu thiếu). Bắt buộc nếu là debt."}
                },
                "required": ["contract_id", "action_type", "new_amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "close_contract",
            "description": "Tất toán toàn bộ hợp đồng, trả đồ cho khách (chỉ làm việc này nếu khách yêu cầu chuộc đồ).",
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
            "name": "get_contracts_status",
            "description": "Thống kê tình trạng các hợp đồng để xem cái nào Sắp đến hạn, Đến hạn, hoặc Quá hạn (dựa trên chu kỳ 30 ngày).",
            "parameters": {
                "type": "object",
                "properties": {
                    "status_filter": {
                        "type": "string",
                        "description": "Lọc các hợp đồng theo tình trạng cụ thể. BẮT BUỘC chọn 1 trong: 'Sắp đến hạn', 'Đến hạn', 'Quá hạn', 'Thanh lý', hoặc 'Tất cả' (nếu muốn xem hết)."
                    }
                },
                "required": ["status_filter"]
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

SYSTEM_PROMPT = """Bạn là trợ lý AI quản lý tiệm Cầm Đồ 55. Bạn có thể tra cứu hợp đồng, tính toán tiền lãi, tái ký, tất toán, tạo hợp đồng mới và thanh lý hợp đồng. 
Khi tạo hợp đồng mới: Dùng `create_contract`. Lưu ý: Tất cả hợp đồng thêm mới qua Telegram đều mặc định là "Hợp đồng Tín chấp". Nếu khách không nói ngày thì không truyền `start_date` (mặc định hôm nay). Nếu không nói lãi thì không truyền `interest_rate` (mặc định 2000).

Quy trình tái ký (Đóng lãi): 
1. Khách báo đóng X tiền -> Dùng `auto_calc_renew` để lấy gợi ý. 
2. Trình bày các lựa chọn cho người dùng (Khách đóng dư/thiếu/đủ ra sao). 
3. Chờ chủ tiệm xác nhận chọn phương án nào (VD: Chọn phương án A - Lãi nhập gốc).
4. Dùng `execute_renew_action` để thực hiện theo ý chủ tiệm.

LƯU Ý CỰC KỲ QUAN TRỌNG KHI GỌI HÀM `get_contracts_status`:
- Khách hỏi "đến hạn" -> BẮT BUỘC gọi `status_filter="Đến hạn"`. Tuyệt đối không gọi "Tất cả" hay "Quá hạn".
- Khách hỏi "quá hạn" -> BẮT BUỘC gọi `status_filter="Quá hạn"`.
- Khách hỏi "sắp đến hạn" -> BẮT BUỘC gọi `status_filter="Sắp đến hạn"`.
- Chỉ xuất ra ĐÚNG những hợp đồng mà hàm trả về. Không tự biên tự diễn tình trạng.

QUY TẮC HIỂN THỊ (BẮT BUỘC):
1. Danh sách hợp đồng (tra cứu hoặc báo cáo) phải theo format:
📊 DANH SÁCH HỢP ĐỒNG ({số lượng})

━━━━━━━━━━━━━━━━━━
📄 Mã: {contract_id}
👤 {customer_name}
💰 {amount}đ
📅 {current_days} ngày | {status_icon} {alert_status}
📌 {status}
━━━━━━━━━━━━━━━━━━

2. Khi thông báo thành công (Tạo mới, Tất toán, Tái ký, Thanh lý), luôn dùng format:
✅ ĐÃ THỰC HIỆN THÀNH CÔNG

━━━━━━━━━━━━━━━━━━
📄 Mã HĐ: {contract_id}
👤 Khách hàng: {customer_name}
💰 Số tiền: {amount}đ
📅 Ngày vay: {start_date}
{Thêm các field tuỳ ý nếu cần, ví dụ: Lãi suất, Tiền đóng, Tiền thừa...}

Quy tắc chung:
- Icon ({status_icon}): Bình thường 🟢, Sắp đến hạn 🟡, Quá hạn 🔴, Đến hạn 🔴.
- Số tiền phải có dấu phẩy. Bỏ qua field nếu thiếu data. Không giải thích dài dòng.

Chú ý: Hãy xưng hô là "Em" và gọi "Đại ca" thật thân thiện, chuyên nghiệp.
Nếu Đại ca hỏi thăm, trêu đùa hoặc hỏi những việc ngoài công việc cầm đồ (thời tiết, ngày giờ, chuyện linh tinh...), hãy trả lời vui vẻ, dí dỏm như một người đàn em trung thành, không cần từ chối khô khan."""

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
