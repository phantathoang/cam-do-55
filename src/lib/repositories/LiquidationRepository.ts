import { getDb, Liquidation } from '../db';

export async function createLiquidation(contract_id: string, asset: string, loan_amount: number) {
  const db = await getDb();
  await db.execute(
    'INSERT INTO liquidations (contract_id, asset, loan_amount, status) VALUES ($1, $2, $3, $4)',
    [contract_id, asset, loan_amount, 'Đang thanh lý']
  );
}

export async function updateLiquidation(id: number, price: number, date: string) {
  const db = await getDb();
  await db.execute(
    `UPDATE liquidations SET liquidation_price = $1, liquidation_date = $2, status = 'Đã thanh lý' WHERE id = $3`,
    [price, date, id]
  );
}

export async function getLiquidations(): Promise<Liquidation[]> {
  const db = await getDb();
  return db.select(`
    SELECT l.* 
    FROM liquidations l
    JOIN contracts c ON l.contract_id = c.id
    WHERE c.deleted_at IS NULL
    ORDER BY l.id DESC
  `);
}
