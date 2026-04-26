import { getDb } from '../db';

export async function createAuditLog(user_id: number | null, action: string, target_table: string, target_id: string, details?: string) {
  const db = await getDb();
  await db.execute(
    'INSERT INTO audit_logs (user_id, action, target_table, target_id, details) VALUES ($1, $2, $3, $4, $5)',
    [user_id, action, target_table, target_id, details || null]
  );
}

