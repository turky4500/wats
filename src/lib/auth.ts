import { compare, hash } from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, hashed: string): Promise<boolean> {
  return compare(password, hashed);
}

export function generateToken(len = 32): string {
  const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({length: len}, () => c[Math.floor(Math.random() * c.length)]).join("");
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return local[0] + "***" + local[local.length-1] + "@" + domain;
}
