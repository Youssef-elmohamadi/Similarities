import { describe, it, expect } from 'vitest';
import {
  APP_VERSION,
  WHATSAPP_NUMBER,
  getWhatsAppUrl,
  formatWhatsAppDisplay,
} from './appConfig';
import packageJson from '../../package.json';

describe('App Configuration & WhatsApp Helper Tests', () => {
  it('exports correct app version matching package.json', () => {
    expect(APP_VERSION).toBe(`v${packageJson.version}`);
    expect(APP_VERSION).toBe('v1.0.0');
  });

  it('exports valid international WhatsApp number digits only', () => {
    expect(WHATSAPP_NUMBER).toBe('201098337262');
    expect(/^\d+$/.test(WHATSAPP_NUMBER)).toBe(true);
  });

  it('generates correct wa.me link with URL-encoded prefilled text', () => {
    const prefilled = 'السلام عليكم، لدي ملاحظة بخصوص موقع متشابهات القرآن';
    const url = getWhatsAppUrl(prefilled);
    expect(url).toBe(`https://wa.me/201098337262?text=${encodeURIComponent(prefilled)}`);
  });

  it('formats Egyptian mobile numbers with international dial code correctly', () => {
    const formatted = formatWhatsAppDisplay('201098337262');
    expect(formatted).toBe('+20 109 833 7262');
  });

  it('handles empty or custom whatsapp number gracefully', () => {
    expect(formatWhatsAppDisplay('')).toBe('');
    expect(formatWhatsAppDisplay('966501234567')).toBe('+966501234567');
  });
});

