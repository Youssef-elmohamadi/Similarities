// App-wide configuration constants

export const APP_VERSION = 'v1.0.0';

// International format, digits only, no + or spaces (e.g. '201098337262')
export const WHATSAPP_NUMBER = (import.meta.env.VITE_WHATSAPP_NUMBER || '201098337262').replace(/\D/g, '');

export function getWhatsAppUrl(prefilledText: string): string {
  if (!WHATSAPP_NUMBER) return '';
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(prefilledText)}`;
}

export function formatWhatsAppDisplay(numberStr: string = WHATSAPP_NUMBER): string {
  const digits = numberStr.replace(/\D/g, '');
  if (!digits) return '';
  // Format Egypt: 20 109 833 7262 -> +20 109 833 7262
  if (digits.startsWith('20') && digits.length === 12) {
    return `+20 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}

