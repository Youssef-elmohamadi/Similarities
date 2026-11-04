import React, { useState, useEffect } from 'react';
import { useAppearance, QuranFontFamily, QuranFontSize } from '@/context/AppearanceContext';
import { useLanguage } from '@/context/LanguageContext';
import { Card } from '@/components/common/Card';
import { VerseText } from '@/components/quran/VerseText';
import { getFullVerseById } from '@/offline/quranDb';
import { api } from '@/lib/api';
import { Type, Sparkles, Check, RefreshCw } from 'lucide-react';

interface PreviewVerseData {
  surahNameArabic: string;
  ayahNumber: number;
  uthmaniText: string;
}

export const AppearancePanel: React.FC = () => {
  const { fontFamily, fontSize, setFontFamily, setFontSize } = useAppearance();
  const { t } = useLanguage();

  const [previewVerse, setPreviewVerse] = useState<PreviewVerseData | null>(null);
  const [activeVerseId, setActiveVerseId] = useState<number>(799); // Surah 6:10 (ID 799)
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadVerse = async () => {
      setIsLoading(true);
      try {
        let v = await getFullVerseById(activeVerseId);
        if (!v) {
          const res = await api.get(`/quran/verses/${activeVerseId}`);
          v = res.data;
        }
        if (mounted && v) {
          setPreviewVerse({
            surahNameArabic: v.surahNameArabic,
            ayahNumber: v.ayahNumber,
            uthmaniText: v.uthmaniText,
          });
        }
      } catch {
        // Fallback static verse 6:10 if completely offline and DB not ready
        if (mounted) {
          setPreviewVerse({
            surahNameArabic: 'الأنعام',
            ayahNumber: 10,
            uthmaniText: 'وَلَقَدِ ٱسْتُهْزِئَ بِرُسُلٍۢ مِّن قَبْلِكَ فَحَاقَ بِٱلَّذِينَ سَخِرُوا۟ مِنْهُم مَّا كَانُوا۟ بِهِۦ يَسْتَهْزِءُونَ',
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadVerse();
    return () => {
      mounted = false;
    };
  }, [activeVerseId]);

  const toggleSampleVerse = () => {
    // Alternate between 6:10 (799) and 2:255 (262 - Ayat Al-Kursi)
    setActiveVerseId(prev => (prev === 799 ? 262 : 799));
  };

  const fontOptions: { id: QuranFontFamily; label: string; sublabel: string; preview: string }[] = [
    {
      id: 'scheherazade',
      label: 'Scheherazade New',
      sublabel: t('حديث ومتزن (الافتراضي)', 'Modern & Calm (Default)'),
      preview: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    },
    {
      id: 'amiri',
      label: 'Amiri Quran',
      sublabel: t('أميري قرآن كلاسيكي', 'Classical Amiri Quran'),
      preview: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    },
    {
      id: 'noto',
      label: 'Noto Naskh Arabic',
      sublabel: t('نوتو نسخ هندسي واضح', 'Geometric Noto Naskh'),
      preview: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    },
  ];

  const sizeOptions: { id: QuranFontSize; label: string; desc: string }[] = [
    { id: 'small', label: t('صغير', 'Small'), desc: '1.2rem' },
    { id: 'medium', label: t('متوسط (افتراضي)', 'Medium (Default)'), desc: '1.35rem' },
    { id: 'large', label: t('كبير', 'Large'), desc: '1.55rem' },
  ];

  return (
    <Card className="space-y-4 md:space-y-5 p-3.5 sm:p-5">
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/70">
        <h2 className="font-semibold text-sm md:text-base text-text-primary flex items-center gap-2">
          <Type className="w-5 h-5 text-primary" />
          <span>{t('المظهر والخط القرآني', 'Quran Typography & Appearance')}</span>
        </h2>
        <span className="text-[11px] md:text-xs text-text-secondary bg-surface px-2.5 py-0.5 rounded-full border border-border">
          {t('حفظ تلقائي وفوري', 'Autosaved')}
        </span>
      </div>

      {/* Font Family Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-text-secondary">
          {t('نوع الخط القرآني المعتمد:', 'Quran Font Family:')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {fontOptions.map(option => {
            const isSelected = fontFamily === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFontFamily(option.id)}
                className={`p-3 rounded-xl border text-start transition relative flex flex-col justify-between min-h-[72px] ${
                  isSelected
                    ? 'bg-primary-tint/40 border-primary shadow-xs ring-1 ring-primary/40'
                    : 'bg-background hover:bg-surface border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full mb-1">
                  <span className="text-xs font-bold text-text-primary">{option.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                </div>
                <span className="text-[11px] text-text-secondary block">{option.sublabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Size Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-text-secondary">
          {t('حجم خط الآيات:', 'Verse Text Size:')}
        </label>
        <div className="grid grid-cols-3 gap-2">
          {sizeOptions.map(option => {
            const isSelected = fontSize === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setFontSize(option.id)}
                className={`py-2 px-3 rounded-xl border text-center transition flex flex-col items-center justify-center min-h-[50px] ${
                  isSelected
                    ? 'bg-primary-tint/40 border-primary font-bold text-primary shadow-xs ring-1 ring-primary/40'
                    : 'bg-background hover:bg-surface border-border text-text-secondary hover:text-text-primary text-xs'
                }`}
              >
                <span className="text-xs font-semibold">{option.label}</span>
                <span className="text-[10px] opacity-75">{option.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Preview Box */}
      <div className="space-y-2 pt-2 border-t border-border/70">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-text-primary flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>
              {t('معاينة حية للنص القرآني', 'Live Quran Preview')}
              {previewVerse && ` (سورة ${previewVerse.surahNameArabic}: ${previewVerse.ayahNumber})`}
            </span>
          </span>
          <button
            type="button"
            onClick={toggleSampleVerse}
            disabled={isLoading}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 bg-surface px-2 py-0.5 rounded border border-border transition"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{t('تبديل الآية', 'Switch Ayah')}</span>
          </button>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#FAF7F0] dark:bg-stone-900 border border-border shadow-2xs overflow-visible">
          {previewVerse ? (
            <div className="text-start">
              <VerseText
                uthmaniText={previewVerse.uthmaniText}
                ayahNumber={previewVerse.ayahNumber}
                highlightedPhrase={previewVerse.ayahNumber === 10 ? 'يَسْتَهْزِءُونَ' : 'ٱلْقَيُّومُ'}
              />
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-text-secondary animate-pulse">
              {t('جارٍ تحميل الآية من قاعدة البيانات...', 'Loading verse from database...')}
            </div>
          )}
        </div>
        <p className="text-[11px] text-text-secondary leading-relaxed px-1">
          {t(
            'يطبق حجم الخط ونوعه المختار فوراً على جميع شاشات التطبيق: نتائج البحث، تفاصيل المجموعات، ومحرر المقارنة.',
            'Selected font and size apply immediately across search results, collection details, and comparison views.'
          )}
        </p>
      </div>
    </Card>
  );
};

