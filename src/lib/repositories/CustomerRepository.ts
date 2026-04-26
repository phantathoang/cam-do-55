import { getDb, Customer } from '../db';
import { encryptPII, decryptPII } from '../crypto';

export async function getCustomers(): Promise<Customer[]> {
  const db = await getDb();
  const rows = await db.select<Customer[]>('SELECT * FROM customers ORDER BY name ASC');
  return rows.map(r => ({
    ...r,
    cccd: decryptPII(r.cccd) as string,
    address_hktt: decryptPII(r.address_hktt) as string,
    address_current: decryptPII(r.address_current) as string,
  }));
}

export async function createCustomer(name: string, phone: string) {
  const db = await getDb();
  const result = await db.execute('INSERT INTO customers (name, phone) VALUES ($1, $2)', [name, phone]);
  return result.lastInsertId;
}

export async function updateCustomer(id: number, updates: Partial<Customer>) {
  const db = await getDb();
  const validKeys = ['name', 'phone', 'cccd', 'cccd_date', 'cccd_place', 'address_hktt', 'address_current', 'debt'];
  
  const entries = Object.entries(updates).filter(([k]) => validKeys.includes(k) && updates[k as keyof Customer] !== undefined);
  if (entries.length === 0) return;

  const setClause = entries.map(([k], i) => `${k} = $${i + 1}`).join(', ');
  const values = entries.map(([k, v]) => {
    if (['cccd', 'address_hktt', 'address_current'].includes(k)) {
      return encryptPII(v as string);
    }
    return v;
  });
  
  await db.execute(`UPDATE customers SET ${setClause} WHERE id = $${values.length + 1}`, [...values, id]);
}

export async function getCustomerByPhone(phone: string): Promise<Customer | null> {
  const db = await getDb();
  const rows = await db.select<Customer[]>('SELECT * FROM customers WHERE phone = $1', [phone]);
  if (rows.length > 0) {
    const r = rows[0];
    return {
      ...r,
      cccd: decryptPII(r.cccd) as string,
      address_hktt: decryptPII(r.address_hktt) as string,
      address_current: decryptPII(r.address_current) as string,
    };
  }
  return null;
}
