/**
 * High-precision TypeScript implementation of ArabicNormalizer & QueryParser,
 * byte-for-byte and logic-for-logic identical to C# backend ArabicNormalizer.cs.
 */

// Tatweel with hamza above (\u0640\u0654) represents Hamza on Nabrah (ئ) (e.g. خَاطِـِٔينَ -> خاطئين)
const TatweelWithHamzaRegex = /\u0640\u0654/g;

// Dagger Alef on Waw before Taa Marbuta (e.g. صلوٰة -> صلاة, زكوٰة -> زكاة, حيوٰة -> حياة)
const WawDaggerAlefTaaMarbutaRegex = /و\u0670(?=[ةه])/g;

// Dagger Alef on Alif Maqsura / Yaa followed by another letter (e.g. ضُحَىٰهَا -> ضحاها)
const YaaDaggerAlefMedialRegex = /[\u0649\u064A]\u0670(?=[\u0600-\u06FF])/g;

// Dagger Alef on Alif Maqsura / Yaa at word end (e.g. مُوسَىٰ -> موسى, عَلَىٰ -> على)
const YaaDaggerAlefFinalRegex = /[\u0649\u064A]\u0670/g;

// Standard Dagger Alef / Superscript Alef: \u0670
const DaggerAlefRegex = /\u0670/g;

// Small High Quranic letters
const SmallHighWawRegex = /\u06E5/g;
const SmallHighYehRegex = /[\u06E6\u06E7]/g;

// Tashkeel / Harakat characters & Quranic marks
const TashkeelRegex = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u08A0-\u08FF\u2000-\u206F\uFEFF]/g;

// Tatweel / Kashida
const TatweelRegex = /\u0640/g;

// Verse end badges, brackets, punctuation, and numbers
const VerseEndMarkersAndDigitsRegex = /[\uFD3E\uFD3F﴿﴾\[\]\(\)\{\}:;!?،–—\-0-9\u0660-\u0669]/g;

// Normalize Alef variants: أ, إ, آ, ٱ -> ا
const AlefVariantsRegex = /[إأآٱ]/g;

// Hamza followed by Alef (Madd Badal): ءا -> ا
const HamzaAlefRegex = /ء[\u064B-\u065F]*[اٱ]/g;

// Normalize Yaa variants: ى, ی -> ي
const YaaRegex = /[\u0649\u06CC]/g;

// Normalize Taa Marbuta: ة -> ه
const TaaMarbutaRegex = /ة/g;

// Normalize Persian/Urdu variants: ک -> ك, گ -> ك
const PersianKafRegex = /[\u06A9\u06AF]/g;

// Small high rounded zero \u06DF and upright rectangular zero \u06E0 mark silent letters
const SilentLetterWithZeroMarkRegex = /[\u0600-\u06FF][\u064B-\u065F\u0670]?[\u06DF\u06E0]/g;
const IsolatedZeroMarksRegex = /[\u06DF\u06E0]/g;

// Trailing Waw + Alef at word end: وا -> و
const TrailingWawAlefRegex = /و[\u064B-\u065F]*[اٱ][\u064B-\u065F]*$/;

// Unify all non-Alef hamza variants (ؤ, ئ) to bare hamza symbol 'ء'
const HamzaWawYehRegex = /[ؤئ]/g;

// Multiple spaces
const MultipleSpacesRegex = /\s+/g;

// Dictionary of well-known Uthmani dagger-alef words to standard orthography
// In JS/V8, \b only matches ASCII word characters [A-Za-z0-9_]. For Arabic, use Unicode-aware boundary (?<![\u0600-\u06FF]) and (?![\u0600-\u06FF])
const UthmaniStandardReplacements: [RegExp, string][] = [
  [/(?<![\u0600-\u06FF])الرحمان(?![\u0600-\u06FF])/g, 'الرحمن'],
  [/(?<![\u0600-\u06FF])داوود(?![\u0600-\u06FF])/g, 'داود'],
  [/(?<![\u0600-\u06FF])ذالك(?![\u0600-\u06FF])/g, 'ذلك'],
  [/(?<![\u0600-\u06FF])ذالكم(?![\u0600-\u06FF])/g, 'ذلكم'],
  [/(?<![\u0600-\u06FF])ذالكن(?![\u0600-\u06FF])/g, 'ذلكن'],
  [/(?<![\u0600-\u06FF])هاذا(?![\u0600-\u06FF])/g, 'هذا'],
  [/(?<![\u0600-\u06FF])هاذه(?![\u0600-\u06FF])/g, 'هذه'],
  [/(?<![\u0600-\u06FF])هاذان(?![\u0600-\u06FF])/g, 'هذان'],
  [/(?<![\u0600-\u06FF])هاذين(?![\u0600-\u06FF])/g, 'هذين'],
  [/(?<![\u0600-\u06FF])(هاولاء|هاؤلاء)(?![\u0600-\u06FF])/g, 'هؤلاء'],
  [/(?<![\u0600-\u06FF])الاه(?![\u0600-\u06FF])/g, 'اله'],
  [/(?<![\u0600-\u06FF])الاهكم(?![\u0600-\u06FF])/g, 'الهكم'],
  [/(?<![\u0600-\u06FF])الاهنا(?![\u0600-\u06FF])/g, 'الهنا'],
  [/(?<![\u0600-\u06FF])الاهين(?![\u0600-\u06FF])/g, 'الهين'],
  [/(?<![\u0600-\u06FF])لاكن(?![\u0600-\u06FF])/g, 'لكن'],
  [/(?<![\u0600-\u06FF])لاكنه(?![\u0600-\u06FF])/g, 'لكنه'],
  [/(?<![\u0600-\u06FF])لاكنهم(?![\u0600-\u06FF])/g, 'لكنهم'],
  [/(?<![\u0600-\u06FF])(اولائك|اولاءك)(?![\u0600-\u06FF])/g, 'اولئك'],
  [/(?<![\u0600-\u06FF])الصلوه(?![\u0600-\u06FF])/g, 'الصلاة'],
  [/(?<![\u0600-\u06FF])صلوه(?![\u0600-\u06FF])/g, 'صلاة'],
  [/(?<![\u0600-\u06FF])الزكوه(?![\u0600-\u06FF])/g, 'الزكاة'],
  [/(?<![\u0600-\u06FF])زكوه(?![\u0600-\u06FF])/g, 'زكاة'],
  [/(?<![\u0600-\u06FF])الحيوه(?![\u0600-\u06FF])/g, 'الحياة'],
  [/(?<![\u0600-\u06FF])حيوه(?![\u0600-\u06FF])/g, 'حياة'],
];

export function normalizeArabic(input?: string | null): string {
  if (!input || !input.trim()) return '';

  let text = input.trim();

  // 1. Remove verse-end markers, punctuation and digits
  text = text.replace(VerseEndMarkersAndDigitsRegex, ' ');

  // 2. Tatweel with hamza above represents Hamza on Nabrah (ئ)
  text = text.replace(TatweelWithHamzaRegex, 'ئ');

  // 3. Expand small high yeh and small high waw
  text = text.replace(SmallHighYehRegex, 'ي');
  text = text.replace(SmallHighWawRegex, 'و');

  // 4. Handle Uthmani Dagger Alef in specific letter contexts:
  text = text.replace(WawDaggerAlefTaaMarbutaRegex, 'ا');
  text = text.replace(YaaDaggerAlefMedialRegex, 'ا');
  text = text.replace(YaaDaggerAlefFinalRegex, 'ى');
  text = text.replace(DaggerAlefRegex, 'ا');

  // 5. Remove Tashkeel & Quranic marks
  text = text.replace(TashkeelRegex, '');

  // 6. Remove Tatweel
  text = text.replace(TatweelRegex, '');

  // 7. Normalize Alef variants
  text = text.replace(AlefVariantsRegex, 'ا');

  // 8. Normalize Hamza followed by Alef
  text = text.replace(HamzaAlefRegex, 'ا');

  // 9. Normalize Yaa / Alif Maqsura
  text = text.replace(YaaRegex, 'ي');

  // 10. Normalize Taa Marbuta
  text = text.replace(TaaMarbutaRegex, 'ه');

  // 11. Normalize Kaf
  text = text.replace(PersianKafRegex, 'ك');

  // 12. Replace Uthmani dagger-alef words to standard orthography
  for (const [pattern, replacement] of UthmaniStandardReplacements) {
    const normReplacement = replacement.replace(TaaMarbutaRegex, 'ه');
    text = text.replace(pattern, normReplacement);
  }

  // 13. Collapse multiple whitespace and trim
  return text.replace(MultipleSpacesRegex, ' ').trim();
}

export function toPhoneticSingleToken(token?: string | null): string {
  if (!token || !token.trim()) return '';

  let text = token.trim();
  text = text.replace(VerseEndMarkersAndDigitsRegex, '');
  if (!text.trim()) return '';

  // Remove zero-width spaces/joiners early (\u2000-\u206F, \uFEFF) to avoid creating artificial word splits
  text = text.replace(/[\u2000-\u206F\uFEFF]/g, '');

  // a. Remove silent letters marked with U+06DF / U+06E0
  text = text.replace(SilentLetterWithZeroMarkRegex, '');
  text = text.replace(IsolatedZeroMarksRegex, '');

  // a. Remove silent alef after final waw jamaa
  text = text.replace(TrailingWawAlefRegex, 'و');

  // b. Expand small high letters
  text = text.replace(SmallHighYehRegex, 'ي');
  text = text.replace(SmallHighWawRegex, 'و');

  // b. Handle dagger alef in specific contexts
  text = text.replace(WawDaggerAlefTaaMarbutaRegex, 'ا');
  text = text.replace(YaaDaggerAlefMedialRegex, 'ا');
  text = text.replace(YaaDaggerAlefFinalRegex, 'ى');
  text = text.replace(DaggerAlefRegex, 'ا');

  // c. Tatweel with hamza represents Hamza on Nabrah
  text = text.replace(TatweelWithHamzaRegex, 'ئ');

  // c. Convert alef wasla and hamza-alef forms to ا
  text = text.replace(AlefVariantsRegex, 'ا');
  text = text.replace(HamzaAlefRegex, 'ا');

  // c. Unify non-alef hamzas (ؤ, ئ, ء) to 'ء'
  text = text.replace(HamzaWawYehRegex, 'ء');

  // d. Unify ى/ي, ة/ه, ک/ك
  text = text.replace(YaaRegex, 'ي');
  text = text.replace(TaaMarbutaRegex, 'ه');
  text = text.replace(PersianKafRegex, 'ك');

  // e. Remove remaining tashkeel, Quranic marks, and tatweel
  text = text.replace(TashkeelRegex, '');
  text = text.replace(TatweelRegex, '');

  // g. Standardize elided dagger alef words
  for (const [pattern, replacement] of UthmaniStandardReplacements) {
    const normReplacement = replacement.replace(TaaMarbutaRegex, 'ه');
    text = text.replace(pattern, normReplacement);
  }

  return text.trim();
}

export function toPhonetic(input?: string | null): string {
  if (!input || !input.trim()) return '';
  // Note: Uthmani words may contain internal zero-width characters (e.g. U+200A hair space, U+2060 word joiner)
  // which must NOT split the token. We split strictly by ASCII space ' ' matching C# Tokenize
  const tokens = input.trim().split(' ').filter(Boolean);
  return tokens.map(t => toPhoneticSingleToken(t)).join(' ');
}

export function toConsonantalSkeleton(input?: string | null): string {
  if (!input || !input.trim()) return '';
  const text = normalizeArabic(input);
  if (!text) return '';

  const words = text.split(/\s+/).filter(Boolean);
  const skeletonWords = words.map(word => {
    let w = word;
    w = w.replace(/ؤ/g, 'و');
    w = w.replace(/ئ/g, 'ي');
    w = w.replace(/ء(?=[وي])/g, 'ي');
    w = w.replace(/ء/g, 'ا');
    w = w.replace(/[ءئؤايه]$/, 'ا');
    w = w.replace(/ا{2,}/g, 'ا');
    return w;
  });

  return skeletonWords.join(' ');
}

export interface ParsedQuery {
  originalQuery: string;
  phrases: string[];
  words: string[];
  excludedWords: string[];
  directReference?: { surahNumber: number; ayahNumber: number } | null;
  hasSearchTerms: boolean;
}

const SurahNameMap: Record<string, number> = {
  'الفاتحه': 1, 'الفاتحة': 1,
  'البقره': 2, 'البقرة': 2,
  'ال عمران': 3, 'ال عمرن': 3, 'آل عمران': 3,
  'النساء': 4,
  'المائده': 5, 'المائدة': 5,
  'الانعام': 6, 'الأنعام': 6,
  'الاعراف': 7, 'الأعراف': 7,
  'الانفال': 8, 'الأنفال': 8,
  'التوبه': 9, 'التوبة': 9, 'براءه': 9, 'براءة': 9,
  'يونس': 10, 'هود': 11, 'يوسف': 12, 'الرعد': 13,
  'ابراهيم': 14, 'إبراهيم': 14, 'الحجر': 15, 'النحل': 16,
  'الاسراء': 17, 'الإسراء': 17, 'بني اسرائيل': 17,
  'الكهف': 18, 'مريم': 19, 'طه': 20,
  'الانبياء': 21, 'الأنبياء': 21, 'الحج': 22,
  'المؤمنون': 23, 'المومنون': 23, 'النور': 24, 'الفرقان': 25,
  'الشعراء': 26, 'النمل': 27, 'القصص': 28, 'العنكبوت': 29,
  'الروم': 30, 'لقمان': 31, 'السجده': 32, 'السجدة': 32,
  'الاحزاب': 33, 'الأحزاب': 33, 'سبا': 34, 'سبأ': 34,
  'فاطر': 35, 'يس': 36, 'ياسين': 36, 'الصافات': 37,
  'ص': 38, 'صاد': 38, 'الزمر': 39, 'غافر': 40, 'المؤمن': 40,
  'فصلت': 41, 'الشوري': 42, 'الشورى': 42, 'الزخرف': 43,
  'الدخان': 44, 'الجاثيه': 45, 'الجاثية': 45, 'الاحقاف': 46, 'الأحقاف': 46,
  'محمد': 47, 'الفتح': 48, 'الحجرات': 49, 'ق': 50, 'قاف': 50,
  'الذاريات': 51, 'الطور': 52, 'النجم': 53, 'القمر': 54,
  'الرحمن': 55, 'الواقعه': 56, 'الواقعة': 56, 'الحديد': 57,
  'المجادله': 58, 'المجادلة': 58, 'الحشر': 59, 'الممتحنه': 60, 'الممتحنة': 60,
  'الصف': 61, 'الجمعه': 62, 'الجمعة': 62, 'المنافقون': 63, 'التغابن': 64,
  'الطلاق': 65, 'التحريم': 66, 'الملك': 67, 'تبارك': 67, 'القلم': 68,
  'الحاقه': 69, 'الحاقة': 69, 'المعارج': 70, 'نوح': 71, 'الجن': 72,
  'المزمل': 73, 'المدثر': 74, 'القيامه': 75, 'القيامة': 75,
  'الانسان': 76, 'الإنسان': 76, 'الدهر': 76, 'المرسلات': 77,
  'النبأ': 78, 'النبا': 78, 'عم': 78, 'النازعات': 79, 'عبس': 80,
  'التكوير': 81, 'الانفطار': 82, 'الإنفطار': 82, 'المطففين': 83,
  'الانشقاق': 84, 'الإنشقاق': 84, 'البروج': 85, 'الطارق': 86,
  'الاعلي': 87, 'الأعلى': 87, 'الغاشيه': 88, 'الغاشية': 88,
  'الفجر': 89, 'البلد': 90, 'الشمس': 91, 'الليل': 92,
  'الضحي': 93, 'الضحى': 93, 'الشرح': 94, 'الانشراح': 94,
  'التين': 95, 'العلق': 96, 'القدر': 97, 'البينه': 98, 'البينة': 98,
  'الزلزله': 99, 'الزلزلة': 99, 'العاديات': 100, 'القارعه': 101, 'القارعة': 101,
  'التكاثر': 102, 'العصر': 103, 'الهمزه': 104, 'الهمزة': 104,
  'الفيل': 105, 'قريش': 106, 'الماعون': 107, 'الكوثر': 108,
  'الكافرون': 109, 'النصر': 110, 'المسد': 111, 'تبت': 111,
  'الاخلاص': 112, 'الإخلاص': 112, 'الفلق': 113, 'الناس': 114,
};

export function parseQuery(input?: string | null): ParsedQuery {
  const result: ParsedQuery = {
    originalQuery: input?.trim() || '',
    phrases: [],
    words: [],
    excludedWords: [],
    directReference: null,
    hasSearchTerms: false,
  };

  if (!input || !input.trim()) return result;

  const raw = input.trim();

  // 1. Numeric reference (e.g. 6:10 or 2:255)
  const numMatch = raw.match(/^\s*(\d{1,3})\s*[:/]\s*(\d{1,3})\s*$/);
  if (numMatch) {
    const s = parseInt(numMatch[1], 10);
    const a = parseInt(numMatch[2], 10);
    if (s >= 1 && s <= 114 && a >= 1) {
      result.directReference = { surahNumber: s, ayahNumber: a };
      result.hasSearchTerms = true;
      return result;
    }
  }

  // 2. Named reference (e.g. "الأنعام 10" or "سورة البقرة آية 255")
  const namedMatch = raw.match(/^\s*(?:سورة\s+)?([^\d:]+?)\s*(?:آية|اية)?\s*(\d{1,3})\s*$/);
  if (namedMatch) {
    const sName = normalizeArabic(namedMatch[1]);
    const aNum = parseInt(namedMatch[2], 10);
    if (aNum >= 1 && SurahNameMap[sName]) {
      result.directReference = { surahNumber: SurahNameMap[sName], ayahNumber: aNum };
      result.hasSearchTerms = true;
      return result;
    }
  }

  // 3. Quoted phrases (e.g. "من قبلك")
  let remaining = raw;
  const quoteMatches = raw.matchAll(/"([^"]+)"/g);
  for (const m of quoteMatches) {
    const phrase = m[1].trim();
    if (phrase) {
      result.phrases.push(phrase);
    }
  }
  remaining = remaining.replace(/"([^"]+)"/g, ' ');

  // 4. Tokenize remaining words, separating exclusions (-term) and search terms
  const tokens = remaining.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (t.startsWith('-') && t.length > 1) {
      const ex = t.substring(1).trim();
      if (ex) result.excludedWords.push(ex);
    } else {
      result.words.push(t);
    }
  }

  result.hasSearchTerms = result.phrases.length > 0 || result.words.length > 0;
  return result;
}
