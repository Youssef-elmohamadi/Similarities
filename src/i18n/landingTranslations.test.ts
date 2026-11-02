import { describe, it, expect } from 'vitest';
import { landingTranslations } from './landingTranslations';

describe('Landing Page & Footer Translations Suite', () => {
  it('contains complete dictionaries for both Arabic (ar) and English (en)', () => {
    expect(landingTranslations.ar).toBeDefined();
    expect(landingTranslations.en).toBeDefined();
  });

  describe('Shared Footer Translations', () => {
    it('has developer dua verbatim in Arabic and English', () => {
      expect(landingTranslations.ar.footer.developerCredit).toBe(
        'طوّره يوسف المحمدي، غفر الله له ولوالديه ولجميع المسلمين.'
      );
      expect(landingTranslations.en.footer.developerCredit).toBe(
        'Developed by Yousef Al-Mohamedy. May Allah forgive him, his parents, and all Muslims.'
      );
    });

    it('has accurate Tanzil text attribution and website', () => {
      expect(landingTranslations.ar.footer.quranSourcePre).toContain('مشروع تنزيل');
      expect(landingTranslations.ar.footer.tanzilLinkText).toBe('tanzil.net');
      expect(landingTranslations.en.footer.quranSourcePre).toContain('Tanzil');
    });

    it('has WhatsApp contact labels and prefilled text in Arabic and English', () => {
      expect(landingTranslations.ar.footer.whatsappContact).toBe('تواصل عبر واتساب');
      expect(landingTranslations.en.footer.whatsappContact).toContain('WhatsApp');
      expect(landingTranslations.ar.footer.whatsappPrefilledMessage).toBe(
        'السلام عليكم، لدي ملاحظة بخصوص موقع متشابهات القرآن'
      );
      expect(landingTranslations.en.footer.whatsappPrefilledMessage).toContain('Quranic Similarities');
    });
  });

  describe('Hero & About Sections', () => {
    it('has exact H1 headline and subtext in Arabic and English', () => {
      expect(landingTranslations.ar.hero.h1).toBe('اجمع متشابهات القرآن في مكان واحد، ونظّم مراجعتك');
      expect(landingTranslations.ar.hero.subtext).toContain('منصة شخصية لحافظ القرآن');
      expect(landingTranslations.ar.hero.getStartedBtn).toBe('ابدأ الآن');
      expect(landingTranslations.ar.hero.haveAccountBtn).toBe('لدي حساب');
    });

    it('contains 3 what it IS and 3 what it is NOT points in About', () => {
      expect(landingTranslations.ar.about.isList).toHaveLength(3);
      expect(landingTranslations.ar.about.isNotList).toHaveLength(3);
      expect(landingTranslations.en.about.isList).toHaveLength(3);
      expect(landingTranslations.en.about.isNotList).toHaveLength(3);
    });
  });

  describe('Features & Steps', () => {
    it('contains exactly 6 features matching real application capabilities', () => {
      expect(landingTranslations.ar.features.items).toHaveLength(6);
      expect(landingTranslations.en.features.items).toHaveLength(6);
    });

    it('contains exactly 6 numbered steps in How-To-Use guide', () => {
      expect(landingTranslations.ar.howToUse.steps).toHaveLength(6);
      expect(landingTranslations.en.howToUse.steps).toHaveLength(6);
      expect(landingTranslations.ar.howToUse.steps[0].number).toBe('١');
      expect(landingTranslations.ar.howToUse.steps[5].number).toBe('٦');
    });

    it('contains exactly 4 verified search tip queries', () => {
      const tips = landingTranslations.ar.howToUse.searchTips;
      expect(tips).toHaveLength(4);
      expect(tips[0].label).toBe('«من قبلك»');
      expect(tips[1].label).toBe('رسل -قبلك');
      expect(tips[2].label).toBe('6:10');
      expect(tips[3].label).toBe('استهز');
    });
  });

  describe('FAQ Accordion', () => {
    it('contains exactly 5 accessible FAQ questions and answers', () => {
      expect(landingTranslations.ar.faq.items).toHaveLength(5);
      expect(landingTranslations.en.faq.items).toHaveLength(5);
      expect(landingTranslations.ar.faq.items[0].question).toContain('خاصة');
      expect(landingTranslations.ar.faq.items[1].answer).toContain('تنزيل');
      expect(landingTranslations.ar.faq.items[2].question).toContain('إنترنت');
      expect(landingTranslations.ar.faq.items[3].question).toContain('تلقائياً');
      expect(landingTranslations.ar.faq.items[4].answer).toContain('واتساب');
    });
  });
});
