import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "SAR"): string {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric", month: "long", day: "numeric",
  }).format(new Date(date));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date(date));
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "الآن";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `منذ ${months} شهر`;
  return `منذ ${Math.floor(months / 12)} سنة`;
}

export function getGenderAr(g: string) { return g === "MALE" ? "ذكر" : "أنثى"; }

export function getMaritalStatusAr(s: string): string {
  const m: Record<string,string> = { SINGLE: "أعزب", DIVORCED: "مطلق", WIDOWED: "أرمل", MARRIED: "متزوج" };
  return m[s] || s;
}

export function getDeviceStatusAr(s: string): string {
  const m: Record<string,string> = { CONNECTED: "متصل", DISCONNECTED: "غير متصل", CONNECTING: "جاري الاتصال...", QR_SCAN: "بانتظار مسح الرمز", ERROR: "خطأ" };
  return m[s] || s;
}

export function getSubStatusAr(s: string): string {
  const m: Record<string,string> = { ACTIVE: "نشط", EXPIRED: "منتهي", CANCELLED: "ملغي", PENDING: "قيد الانتظار", FAILED: "فشل" };
  return m[s] || s;
}

export function getUserStatusAr(s: string): string {
  const m: Record<string,string> = { PENDING: "قيد المراجعة", ACTIVE: "نشط", SUSPENDED: "معلق", BANNED: "محظور", DELETED: "محذوف" };
  return m[s] || s;
}

export function getRoleAr(r: string): string {
  const m: Record<string,string> = { USER: "مستخدم", MODERATOR: "مشرف", ADMIN: "مدير", SUPER_ADMIN: "مدير أعلى" };
  return m[r] || r;
}

export function getSupportLevelAr(l: string): string {
  const m: Record<string,string> = { BASIC: "أساسي", STANDARD: "قياسي", PREMIUM: "مميز", VIP: "VIP" };
  return m[l] || l;
}

export function truncate(str: string, len: number): string {
  return str.length <= len ? str : str.slice(0, len) + "...";
}
