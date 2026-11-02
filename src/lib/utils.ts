import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toArabicDigits(num?: number | string | null): string {
  if (num === undefined || num === null) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num.toString().replace(/[0-9]/g, d => arabicDigits[parseInt(d, 10)]);
}

export function formatAyahOrnament(num: number | string): string {
  return `\uFD3F${toArabicDigits(num)}\uFD3E`;
}

/**
 * Splits Quranic Uthmani text into word tokens matching the backend database tokenizer (strictly by ASCII space ' ').
 * Avoids regex \s+ which inadvertently splits on internal Quranic micro-typography such as Hair Space U+200A.
 */
export function tokenizeQuranText(text?: string | null): string[] {
  if (!text) return [];
  return text.trim().split(' ').filter(Boolean);
}

export function formatDate(dateStr: string, locale: string = 'ar-SA'): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'منذ لحظات';
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `منذ ${diffInHours} ساعة`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `منذ ${diffInDays} يوم`;

    return formatDate(dateStr);
  } catch {
    return dateStr;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

