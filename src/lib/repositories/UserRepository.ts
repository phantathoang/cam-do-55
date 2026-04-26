import { getDb, User } from '../db';
import bcrypt from 'bcryptjs';
import { encryptPII, decryptPII } from '../crypto';

export async function getUsers(): Promise<User[]> {
  const db = await getDb();
  const rows = await db.select<User[]>("SELECT id, username, role, full_name, cccd, cccd_date, cccd_place, address, phone FROM users");
  return rows.map(r => ({
    ...r,
    cccd: decryptPII(r.cccd) as string,
    address: decryptPII(r.address) as string,
  }));
}

export async function createUser(u: Partial<User>) {
  const db = await getDb();
  const plainTextPassword = u.password || '123456';
  const hashedPassword = await bcrypt.hash(plainTextPassword, 10);
  await db.execute(
    "INSERT INTO users (username, password, role, full_name, cccd, cccd_date, cccd_place, address, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [u.username, hashedPassword, u.role || 'user', u.full_name, encryptPII(u.cccd), u.cccd_date, u.cccd_place, encryptPII(u.address), u.phone]
  );
}

export async function updateUser(id: number, u: Partial<User>) {
  const db = await getDb();
  if (u.password) {
    const hashedPassword = await bcrypt.hash(u.password, 10);
    await db.execute(
      "UPDATE users SET username=?, password=?, role=?, full_name=?, cccd=?, cccd_date=?, cccd_place=?, address=?, phone=? WHERE id=?",
      [u.username, hashedPassword, u.role, u.full_name, encryptPII(u.cccd), u.cccd_date, u.cccd_place, encryptPII(u.address), u.phone, id]
    );
  } else {
    await db.execute(
      "UPDATE users SET username=?, role=?, full_name=?, cccd=?, cccd_date=?, cccd_place=?, address=?, phone=? WHERE id=?",
      [u.username, u.role, u.full_name, encryptPII(u.cccd), u.cccd_date, u.cccd_place, encryptPII(u.address), u.phone, id]
    );
  }
}

export async function deleteUser(id: number) {
  const db = await getDb();
  await db.execute("DELETE FROM users WHERE id=?", [id]);
}

export async function login(username: string, password: string): Promise<User | null> {
  const db = await getDb();
  const res: any[] = await db.select("SELECT * FROM users WHERE username=?", [username]);
  if (res.length > 0) {
    const user = res[0];
    
    const isHashed = user.password && user.password.startsWith('$2');
    
    let isMatch = false;
    if (isHashed) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = (password === user.password);
    }
    
    if (isMatch) {
      const { password: _, ...userWithoutPassword } = user;
      return {
        ...userWithoutPassword,
        cccd: decryptPII(userWithoutPassword.cccd) as string,
        address: decryptPII(userWithoutPassword.address) as string,
      } as User;
    }
  }
  return null;
}

export async function verifyPassword(username: string, password: string): Promise<boolean> {
  const db = await getDb();
  const res: any[] = await db.select("SELECT password FROM users WHERE username=?", [username]);
  if (res.length > 0) {
    const user = res[0];
    const isHashed = user.password && user.password.startsWith('$2');
    if (isHashed) {
      return await bcrypt.compare(password, user.password);
    } else {
      return password === user.password;
    }
  }
  return false;
}
