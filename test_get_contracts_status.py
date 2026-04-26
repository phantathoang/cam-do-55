import sqlite3
import json
import sys
import os

from datetime import datetime, timedelta

def calculate_days(start_date_str: str) -> int:
    try:
        from dateutil.parser import parse
        start_date = parse(start_date_str)
    except:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    now = datetime.now()
    d1 = datetime(now.year, now.month, now.day)
    d2 = datetime(start_date.year, start_date.month, start_date.day)
    days = (d1 - d2).days
    if days == 0:
        return 2
    elif days > 0:
        return days + 1
    return 0

def calculate_profit(amount: float, interest_rate: float, days_active: int) -> float:
    if not amount or not interest_rate or days_active <= 0: return 0
    return round((days_active * amount * interest_rate) / 1000000)

db_path = os.path.expanduser("~/Library/Application Support/com.hoangtat.cam-do-55/cd_app.db")

def get_contracts_status(status_filter: str = None):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT c.*, cus.name as customer_name, cus.phone as customer_phone FROM contracts c JOIN customers cus ON c.customer_id = cus.id WHERE c.status NOT IN ('Đã xong', 'Thanh Lý')")
    rows = cursor.fetchall()
    conn.close()
    
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
            
        if status_filter and status_filter.lower() != 'tất cả':
            if r['alert_status'].lower() != status_filter.lower():
                continue
        elif r['alert_status'] == 'Bình thường':
            continue
            
        results.append(r)
        
    order = {'Quá hạn': 1, 'Thanh lý': 2, 'Đến hạn': 3, 'Sắp đến hạn': 4, 'Bình thường': 5}
    results.sort(key=lambda x: order.get(x['alert_status'], 99))
    
    return json.dumps(results, ensure_ascii=False)

print("Đến hạn:", get_contracts_status("Đến hạn"))
print("Quá hạn (sample 1):", get_contracts_status("Quá hạn")[:500])
