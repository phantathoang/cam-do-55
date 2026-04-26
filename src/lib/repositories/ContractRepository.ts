import { getDb, Contract } from '../db';
import { format } from 'date-fns';

export async function createContract(
  customerId: number,
  amount: number,
  asset: string,
  interestRate: number,
  startDate: string
) {
  const db = await getDb();
  const now = new Date();
  const id = `HDCD-${format(now, 'yyyy-MM-dd-HH-mm-ss')}`;
  await db.execute(
    `INSERT INTO contracts (id, customer_id, amount, asset, interest_rate, start_date, status) 
     VALUES ($1, $2, $3, $4, $5, $6, 'Đang chờ')`,
    [id, customerId, amount, asset, interestRate, startDate]
  );
  return id;
}

export async function getContracts(): Promise<Contract[]> {
  const db = await getDb();
  return db.select(`
    SELECT c.*, cu.name as customer_name, cu.phone as customer_phone 
    FROM contracts c 
    JOIN customers cu ON c.customer_id = cu.id 
    WHERE c.deleted_at IS NULL
    ORDER BY c.start_date DESC
  `);
}

export async function updateContractStatus(id: string, status: string, lastPaidDate?: string) {
  const db = await getDb();
  if (lastPaidDate) {
    await db.execute('UPDATE contracts SET status = $1, last_paid_date = $2 WHERE id = $3', [status, lastPaidDate, id]);
  } else {
    await db.execute('UPDATE contracts SET status = $1 WHERE id = $2', [status, id]);
  }
}

export async function deleteContract(id: string) {
  const db = await getDb();
  await db.execute('UPDATE contracts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

export async function updateContract(id: string, updates: Partial<Contract>) {
  const db = await getDb();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values = keys.map(k => (updates as any)[k]);
  await db.execute(`UPDATE contracts SET ${setClause} WHERE id = $${keys.length + 1}`, [...values, id]);
}
