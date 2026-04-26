import { getDb } from '../db';

export async function getSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows: any[] = await db.select("SELECT * FROM settings");
  const settings: Record<string, string> = {};
  rows.forEach(r => settings[r.key] = r.value);
  return settings;
}

export async function updateSetting(key: string, value: string) {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=?",
    [key, value, value]
  );
}
