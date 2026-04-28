import Database from '@tauri-apps/plugin-sql';

import bcrypt from 'bcryptjs';

let db: Database | null = null;

export async function getDb() {
  if (!db) {
    db = await Database.load('sqlite:cd_app.db');
    await db.execute('PRAGMA journal_mode=WAL;');
  }
  return db;
}

export async function initDb() {
  const db = await getDb();
  
  await db.execute(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      cccd TEXT,
      cccd_date TEXT,
      cccd_place TEXT,
      address_hktt TEXT,
      address_current TEXT,
      debt INTEGER DEFAULT 0
    );
  `);
  
  const versionResult = await db.select<any[]>('PRAGMA user_version');
  const currentVersion = versionResult[0]?.user_version || 0;

  if (currentVersion < 1) {
    // Migration v1
    try { await db.execute("ALTER TABLE customers ADD COLUMN cccd TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE customers ADD COLUMN cccd_date TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE customers ADD COLUMN cccd_place TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE customers ADD COLUMN address_hktt TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE customers ADD COLUMN address_current TEXT;"); } catch (e) {}
    try { await db.execute("ALTER TABLE customers ADD COLUMN debt INTEGER DEFAULT 0;"); } catch (e) {}
    
    await db.execute('PRAGMA user_version = 1');
  }
  await db.execute(`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      asset TEXT NOT NULL,
      interest_rate INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Đang chờ',
      last_paid_date TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);

  try { await db.execute("ALTER TABLE contracts ADD COLUMN deleted_at TEXT;"); } catch (e) {}
  
  // Performance Indexes
  await db.execute("CREATE INDEX IF NOT EXISTS idx_contracts_customer_id ON contracts(customer_id);");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);");
  await db.execute("CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);");

  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_table TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // ----- BẢNG CORE V2 (ARCHITECTURE PROPOSAL) -----
  await db.execute(`
    CREATE TABLE IF NOT EXISTS loan_contracts (
      id TEXT PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      purpose TEXT,
      loan_term_days INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      interest_rate_month REAL NOT NULL,
      interest_rate_year REAL NOT NULL,
      payment_method TEXT,
      penalty_rate REAL,
      status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SIGNED, CLOSED, DEFAULT
      signed_date TEXT,
      location TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS collateral_contracts (
      id TEXT PRIMARY KEY,
      loan_contract_id TEXT NOT NULL,
      type TEXT NOT NULL, -- CAR_MOTOR, REAL_ESTATE, OTHER_ASSET
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RELEASED, ENFORCED
      metadata TEXT, -- JSON fields for all dynamic properties
      FOREIGN KEY(loan_contract_id) REFERENCES loan_contracts(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS liquidations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id TEXT NOT NULL,
      asset TEXT NOT NULL,
      loan_amount INTEGER NOT NULL,
      liquidation_price INTEGER,
      liquidation_date TEXT,
      status TEXT NOT NULL DEFAULT 'Đang thanh lý',
      FOREIGN KEY(contract_id) REFERENCES contracts(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      full_name TEXT,
      cccd TEXT,
      cccd_date TEXT,
      cccd_place TEXT,
      address TEXT,
      phone TEXT
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Seed default admin
  const admins: any = await db.select("SELECT * FROM users WHERE role = 'admin'");
  if (admins.length === 0) {
    const defaultHash = await bcrypt.hash('admin', 10);
    await db.execute("INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)", ['admin', defaultHash, 'admin', 'NGƯỜI ĐẠI DIỆN 55']);
  }

  // Seed default settings
  const shopName: any = await db.select("SELECT * FROM settings WHERE key = 'shop_name'");
  if (shopName.length === 0) {
    await db.execute("INSERT INTO settings (key, value) VALUES ('shop_name', 'CAMDO55')");
    await db.execute("INSERT INTO settings (key, value) VALUES ('shop_address', '123 Đường Số 1, Quận 1, TP.HCM')");
    await db.execute("INSERT INTO settings (key, value) VALUES ('shop_phone', '0909090909')");
  }
}

export type Customer = {
  id: number;
  name: string;
  phone: string;
  cccd?: string;
  cccd_date?: string;
  cccd_place?: string;
  address_hktt?: string;
  address_current?: string;
  debt?: number;
};

export type Contract = {
  id: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  amount: number;
  asset: string;
  interest_rate: number;
  start_date: string;
  status: string; // 'Đang chờ' | 'Đã xong' | 'Thanh Lý' | 'Quá hạn' (virtual)
  last_paid_date: string | null;
  deleted_at?: string | null;
};

export type LoanContract = {
  id: string;
  customer_id: number;
  customer_name?: string;
  customer_phone?: string;
  amount: number;
  purpose: string;
  loan_term_days: number;
  start_date: string;
  end_date: string;
  interest_rate_month: number;
  interest_rate_year: number;
  payment_method: string;
  penalty_rate: number;
  status: 'DRAFT' | 'SIGNED' | 'CLOSED' | 'DEFAULT';
  signed_date?: string;
  location?: string;
};

export type CollateralContract = {
  id: string;
  loan_contract_id: string;
  type: 'CAR_MOTOR' | 'REAL_ESTATE' | 'OTHER_ASSET';
  status: 'ACTIVE' | 'RELEASED' | 'ENFORCED';
  metadata: string; // JSON string
};

export type Liquidation = {
  id: number;
  contract_id: string;
  asset: string;
  loan_amount: number;
  liquidation_price: number | null;
  liquidation_date: string | null;
  status: 'Đang thanh lý' | 'Đã thanh lý';
};

export type User = {
  id: number;
  username: string;
  password?: string;
  role: string;
  full_name: string;
  cccd: string;
  cccd_date: string;
  cccd_place: string;
  address: string;
  phone: string;
};

export type Setting = {
  key: string;
  value: string;
};

export * from './repositories/LiquidationRepository';
export * from './repositories/CustomerRepository';
export * from './repositories/ContractRepository';
export * from './repositories/UserRepository';
export * from './repositories/SettingRepository';
export * from './repositories/AuditLogRepository';
