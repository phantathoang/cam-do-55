import sqlite3
import random
import os
from datetime import datetime, timedelta

# Path to the Tauri app's SQLite database on macOS
db_path = os.path.expanduser("~/Library/Application Support/com.hoangtat.cam-do-55/cd_app.db")

if not os.path.exists(db_path):
    print(f"Database not found at {db_path}. Please run the app at least once to create it.")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Lists of mock data for generation
first_names = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý"]
middle_names = ["Văn", "Thị", "Thanh", "Minh", "Hữu", "Đức", "Ngọc", "Hải", "Xuân", "Thu", "Hoàng", "Quốc", "Gia", "Tuấn"]
last_names = ["Anh", "Tuấn", "Nam", "Bình", "Hương", "Lan", "Hoa", "Khoa", "Đạt", "Phát", "Lộc", "Tài", "Sang", "Trọng", "Nghĩa", "Tín"]

assets_list = [
    "Tín chấp", "Tín chấp", "Tín chấp", "Tín chấp", # Tăng tỉ lệ tín chấp
    "Xe máy SH 150i", "Xe tay ga Vision", "Xe Yamaha Exciter 155", 
    "Ô tô Mazda 3 2022", "Ô tô Honda CR-V", "Xe tải Kia K200", 
    "Laptop MacBook Pro M2", "Laptop Dell XPS 15", "Điện thoại iPhone 15 Pro Max",
    "Đồng hồ Rolex", "Sổ hồng đất thổ cư", "Nhà phố Q.Tân Bình"
]

def generate_phone():
    return "09" + "".join([str(random.randint(0, 9)) for _ in range(8)])

def generate_cccd():
    return "0" + "".join([str(random.randint(0, 9)) for _ in range(11)])

def random_date(start_date_str, end_date_str):
    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
    time_between_dates = end_date - start_date
    days_between_dates = time_between_dates.days
    random_number_of_days = random.randrange(days_between_dates)
    return start_date + timedelta(days=random_number_of_days)

print("Starting data generation...")

# Clear existing customers and contracts to avoid duplicates if run multiple times
cursor.execute("DELETE FROM liquidations")
cursor.execute("DELETE FROM contracts")
cursor.execute("DELETE FROM customers")

customer_ids = []

# Generate 50 Random Customers
for i in range(50):
    name = f"{random.choice(first_names)} {random.choice(middle_names)} {random.choice(last_names)}"
    phone = generate_phone()
    # Ensure unique phone
    while True:
        try:
            cursor.execute("INSERT INTO customers (name, phone, cccd, address_hktt, address_current) VALUES (?, ?, ?, ?, ?)",
                           (name, phone, generate_cccd(), "TP.HCM", "TP.HCM"))
            customer_ids.append(cursor.lastrowid)
            break
        except sqlite3.IntegrityError:
            phone = generate_phone()

print(f"Inserted {len(customer_ids)} customers.")

# We want exactly 20 overdue contracts
overdue_count = 0
target_overdue = 20

# We want 200 contracts total
for i in range(200):
    contract_id = f"CD-{1000 + i}"
    customer_id = random.choice(customer_ids)
    
    asset = random.choice(assets_list)
    
    if overdue_count < target_overdue:
        # Force overdue
        status = "Quá hạn"
        # Overdue contracts should have small amounts (e.g. 1M to 5M)
        amount = random.randint(1, 5) * 1000000
        # Overdue contract must be created more than 30 days ago to trigger overdue UI correctly
        start_date = random_date("2025-10-01", "2026-03-20").strftime("%Y-%m-%d")
        overdue_count += 1
    else:
        # 75% Đang chờ, 15% Đã xong, 10% Thanh Lý
        rand_status = random.random()
        if rand_status < 0.75:
            status = "Đang chờ"
            start_date = random_date("2026-03-26", "2026-04-25").strftime("%Y-%m-%d")
        elif rand_status < 0.90:
            status = "Đã xong"
            start_date = random_date("2026-01-01", "2026-03-25").strftime("%Y-%m-%d")
        else:
            status = "Thanh Lý"
            start_date = random_date("2026-01-01", "2026-02-25").strftime("%Y-%m-%d")
        
        # Normal amount from 2M to 15M
        amount = random.randint(2, 15) * 1000000

    # Interest Rate Logic: 1000, 1500, 2000, 2500 only
    # Adjusted thresholds to fit the 1.5 billion total (avg 7.5M per contract)
    if amount >= 15000000:
        interest_rate = 1000
    elif amount >= 10000000:
        interest_rate = 1500
    elif amount >= 5000000:
        interest_rate = 2000
    else:
        interest_rate = 2500
        
    cursor.execute("""
        INSERT INTO contracts (id, customer_id, amount, asset, interest_rate, start_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (contract_id, customer_id, amount, asset, interest_rate, start_date, status))
    
    # If it's already "Thanh Lý", we should probably add a liquidation record
    if status == "Thanh Lý":
        # Randomly choose if it's currently liquidating or already done
        liq_status = "Đã thanh lý" if random.random() > 0.5 else "Đang thanh lý"
        liq_price = amount * 0.8 if liq_status == "Đã thanh lý" else None
        liq_date = "2026-04-20" if liq_status == "Đã thanh lý" else None
        
        cursor.execute("""
            INSERT INTO liquidations (contract_id, asset, loan_amount, liquidation_price, liquidation_date, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (contract_id, asset, amount, liq_price, liq_date, liq_status))

conn.commit()
conn.close()

print(f"Successfully inserted 200 contracts ({target_overdue} quá hạn).")
print("Database is now ready with updated mock data!")
