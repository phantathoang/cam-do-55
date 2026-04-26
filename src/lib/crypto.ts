import CryptoJS from 'crypto-js';

function getMasterKey(): string {
  let key = localStorage.getItem('app_master_key');
  if (!key) {
    key = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem('app_master_key', key);
  }
  return key;
}

export function encryptPII(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  if (text.startsWith('ENC:')) return text;
  return 'ENC:' + CryptoJS.AES.encrypt(text, getMasterKey()).toString();
}

export function decryptPII(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  if (!text.startsWith('ENC:')) return text;
  try {
    const bytes = CryptoJS.AES.decrypt(text.slice(4), getMasterKey());
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || text; // fallback to raw if empty decryption
  } catch (e) {
    return text;
  }
}
