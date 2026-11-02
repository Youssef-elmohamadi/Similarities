import React, { useState, useEffect, useId } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/context/LanguageContext';
import { landingTranslations } from '@/i18n/landingTranslations';
import { VerseText } from '@/components/quran/VerseText';
import { AppFooter } from '@/components/layout/AppFooter';
import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { getFullVerseById } from '@/offline/quranDb';
import { WHATSAPP_NUMBER, getWhatsAppUrl } from '@/config/appConfig';
import {
  BookOpen,
  Search,
  BookmarkCheck,
  Sparkles,
  GitCompare,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  MessageCircle,
  HelpCircle,
  Layers,
  FileEdit,
  Tag,
  Compass,
} from 'lucide-react';

interface SampleVerse {
  id: number;
  surahNameArabic: string;
  surahNameEnglish: string;
  ayahNumber: number;
  uthmaniText: string;
}

export const LandingPage: React.FC = () => {
  const { language, toggleLanguage, direction } = useLanguage();
  const tData = landingTranslations[language];
  const isRtl = direction === 'rtl';

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0); // First item open by default

  // Sample verses for the Hero section: 6:10 (ID 799) and 13:32 (ID 1739)
  const [sampleVerses, setSampleVerses] = useState<{ v1: SampleVerse | null; v2: SampleVerse | null }>({
    v1: null,
    v2: null,
  });
  const [isSampleLoading, setIsSampleLoading] = useState(true);

  // SEO & OpenGraph Meta
  useEffect(() => {
    document.title = tData.metaTitle;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', tData.metaDescription);

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', tData.metaTitle);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) {
      ogDesc = document.createElement('meta');
      ogDesc.setAttribute('property', 'og:description');
      document.head.appendChild(ogDesc);
    }
    ogDesc.setAttribute('content', tData.metaDescription);
  }, [language, tData]);

  // Load sample verses 6:10 and 13:32 from public endpoint or local IndexedDB
  useEffect(() => {
    let isMounted = true;
    const fetchSamples = async () => {
      try {
        let v1Data: any = null;
        let v2Data: any = null;

        // Try local IndexedDB first
        try {
          v1Data = await getFullVerseById(799);
          v2Data = await getFullVerseById(1739);
        } catch {}

        // If not in DB, fetch from public API
        if (!v1Data || !v2Data) {
          const [r1, r2] = await Promise.all([
            api.get('/quran/verses/799'),
            api.get('/quran/verses/1739'),
          ]);
          v1Data = r1.data;
          v2Data = r2.data;
        }

        if (isMounted && v1Data && v2Data) {
          setSampleVerses({ v1: v1Data, v2: v2Data });
        }
      } catch (err) {
        console.warn('Could not load sample verses from dataset:', err);
      } finally {
        if (isMounted) setIsSampleLoading(false);
      }
    };

    fetchSamples();
    return () => {
      isMounted = false;
    };
  }, []);

  const sharedPhrase = 'وَلَقَدِ ٱسۡتُهۡزِئَ بِرُسُلࣲ مِّن قَبۡلِكَ';
  const hasWhatsApp = Boolean(WHATSAPP_NUMBER && WHATSAPP_NUMBER.length > 0);
  const whatsappUrl = hasWhatsApp ? getWhatsAppUrl(tData.footer.whatsappPrefilledMessage) : '';

  const featureIcons = [Search, Layers, BookmarkCheck, GitCompare, Sparkles, Wifi];

  return (
    <div className="min-h-screen bg-background text-text-primary selection:bg-accent-tint flex flex-col scroll-smooth motion-reduce:scroll-auto">
      {/* 1. STICKY TOP BAR */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-border transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between">
          {/* Start: Logo + Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-primary text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4 md:w-5 md:h-5" />
            </div>
            <div>
              <span className="font-bold text-sm md:text-base text-text-primary block leading-tight">
                {language === 'ar' ? 'متشابهات القرآن' : 'Quranic Similarities'}
              </span>
              <span className="text-[10px] md:text-[11px] text-primary font-medium block">
                {language === 'ar' ? 'منصة الحفاظ الخاصة' : 'Memorizer Workspace'}
              </span>
            </div>
          </Link>

          {/* Center: In-Page Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-text-secondary" aria-label="Landing Navigation">
            <a href="#about" className="hover:text-primary transition py-1">
              {tData.nav.about}
            </a>
            <a href="#features" className="hover:text-primary transition py-1">
              {tData.nav.features}
            </a>
            <a href="#how-to-use" className="hover:text-primary transition py-1">
              {tData.nav.howToUse}
            </a>
            <a href="#faq" className="hover:text-primary transition py-1">
              {tData.nav.faq}
            </a>
          </nav>

          {/* End: Language Toggle & Auth Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleLanguage}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-border hover:bg-surface text-text-secondary hover:text-text-primary transition"
              aria-label="Toggle language"
            >
              {language === 'ar' ? 'English' : 'عربي'}
            </button>

            {/* Desktop Auth Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  {tData.nav.login}
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="primary" size="sm">
                  {tData.nav.register}
                </Button>
              </Link>
            </div>

            {/* Mobile "ابدأ الآن" Button */}
            <Link to="/register" className="sm:hidden">
              <Button variant="primary" size="sm" className="text-xs px-3">
                {tData.nav.getStarted}
              </Button>
            </Link>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary border border-border"
              aria-label={isMobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Menu */}
        {isMobileMenuOpen && (
          <nav
            className="md:hidden border-b border-border bg-surface px-4 py-3 space-y-2 animate-fade-in text-start"
            aria-label="Mobile Navigation"
          >
            <a
              href="#about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm text-text-secondary hover:text-primary"
            >
              {tData.nav.about}
            </a>
            <a
              href="#features"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm text-text-secondary hover:text-primary"
            >
              {tData.nav.features}
            </a>
            <a
              href="#how-to-use"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm text-text-secondary hover:text-primary"
            >
              {tData.nav.howToUse}
            </a>
            <a
              href="#faq"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-sm text-text-secondary hover:text-primary"
            >
              {tData.nav.faq}
            </a>
            <div className="pt-2 border-t border-border flex items-center gap-2">
              <Link to="/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  {tData.nav.login}
                </Button>
              </Link>
              <Link to="/register" className="flex-1">
                <Button variant="primary" size="sm" className="w-full">
                  {tData.nav.register}
                </Button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1">
        {/* 2. HERO SECTION */}
        <section className="py-6 sm:py-12 md:py-16 px-4 sm:px-6 border-b border-border/50">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 text-center">
            {/* Main Headline & Subtext */}
            <div className="space-y-2.5 sm:space-y-3 max-w-2xl mx-auto">
              <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-[2.1rem] font-bold tracking-tight text-text-primary leading-[1.35]">
                {tData.hero.h1}
              </h1>
              <p className="text-xs sm:text-sm md:text-base text-text-secondary leading-relaxed max-w-xl mx-auto">
                {tData.hero.subtext}
              </p>
            </div>

            {/* Action Buttons (Visible on mobile 360x640 above the fold) */}
            <div className="flex flex-row items-center justify-center gap-2.5 pt-1">
              <Link to="/register">
                <Button
                  variant="primary"
                  size="sm"
                  className="min-h-[40px] px-5 text-xs sm:text-sm font-semibold shadow-xs"
                >
                  {tData.hero.getStartedBtn}
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[40px] px-5 text-xs sm:text-sm font-semibold"
                >
                  {tData.hero.haveAccountBtn}
                </Button>
              </Link>
            </div>

            {/* Decorative Sample Card with Verses 6:10 and 13:32 (Pulled from Dataset) */}
            {!isSampleLoading && sampleVerses.v1 && sampleVerses.v2 && (
              <div className="pt-4 max-w-3xl mx-auto text-start">
                <Card className="p-4 sm:p-6 bg-surface/90 border border-border shadow-xs space-y-4">
                  <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
                    <span className="text-xs font-semibold text-primary inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {tData.hero.sampleCardBadge}
                    </span>
                    <span className="text-xs text-text-secondary font-medium">
                      {sampleVerses.v1.surahNameArabic} ١٠ ⟵ {sampleVerses.v2.surahNameArabic} ٣٢
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {/* Verse 6:10 */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-background border border-border/70 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span className="font-semibold text-text-primary">
                          سورة {sampleVerses.v1.surahNameArabic} — الآية {sampleVerses.v1.ayahNumber}
                        </span>
                      </div>
                      <VerseText
                        uthmaniText={sampleVerses.v1.uthmaniText}
                        ayahNumber={sampleVerses.v1.ayahNumber}
                        highlightedPhrase={sharedPhrase}
                      />
                    </div>

                    {/* Verse 13:32 */}
                    <div className="p-3 sm:p-3.5 rounded-xl bg-background border border-border/70 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span className="font-semibold text-text-primary">
                          سورة {sampleVerses.v2.surahNameArabic} — الآية {sampleVerses.v2.ayahNumber}
                        </span>
                      </div>
                      <VerseText
                        uthmaniText={sampleVerses.v2.uthmaniText}
                        ayahNumber={sampleVerses.v2.ayahNumber}
                        highlightedPhrase={sharedPhrase}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-text-secondary/80 italic text-center pt-1">
                    {tData.hero.sampleDifferenceNote}
                  </p>
                </Card>
              </div>
            )}
          </div>
        </section>

        {/* 3. "عن الموقع" (ABOUT) SECTION */}
        <section id="about" className="py-12 md:py-16 px-4 sm:px-6 border-b border-border/50">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <Badge variant="primary" size="sm">
                {tData.about.sectionTitle}
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {tData.about.heading}
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed pt-1">
                {tData.about.problem}
              </p>
            </div>

            {/* What it IS vs What it is NOT (2-column grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-start">
              {/* What it IS */}
              <Card className="p-5 sm:p-6 space-y-4 border-emerald-600/20 bg-emerald-700/5">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>{tData.about.isTitle}</span>
                </div>
                <ul className="space-y-3 text-sm text-text-secondary leading-relaxed">
                  {tData.about.isList.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* What it is NOT */}
              <Card className="p-5 sm:p-6 space-y-4 border-charcoal-300 dark:border-charcoal-700 bg-surface">
                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                  <span>{tData.about.isNotTitle}</span>
                </div>
                <ul className="space-y-3 text-sm text-text-secondary leading-relaxed">
                  {tData.about.isNotList.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-text-secondary/50 mt-2 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* 4. "المميزات" (FEATURES) SECTION */}
        <section id="features" className="py-12 md:py-16 px-4 sm:px-6 border-b border-border/50">
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <Badge variant="accent" size="sm">
                {tData.features.sectionTitle}
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {tData.features.heading}
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                {tData.features.subtext}
              </p>
            </div>

            {/* 6 Cards: 1 col mobile, 2 tablet, 3 desktop */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-start">
              {tData.features.items.map((feat, idx) => {
                const IconComponent = featureIcons[idx] || Sparkles;
                return (
                  <Card
                    key={idx}
                    hoverable
                    className="p-5 flex flex-col justify-between space-y-3 group border border-border/80"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary-tint text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition duration-150">
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-text-primary group-hover:text-primary transition">
                        {feat.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-text-secondary mt-1 leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. "طريقة الاستخدام" (HOW TO USE) SECTION */}
        <section id="how-to-use" className="py-12 md:py-16 px-4 sm:px-6 border-b border-border/50">
          <div className="max-w-5xl mx-auto space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <Badge variant="primary" size="sm">
                {tData.howToUse.sectionTitle}
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {tData.howToUse.heading}
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                {tData.howToUse.subtext}
              </p>
            </div>

            {/* 6 Steps: Timeline on mobile, 2-column grid on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-start">
              {tData.howToUse.steps.map((st, idx) => (
                <Card
                  key={idx}
                  className="p-5 sm:p-6 border border-border/80 flex items-start gap-4 relative overflow-hidden"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary text-white font-bold text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs">
                    {st.number}
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <h3 className="font-semibold text-base text-text-primary">
                      {st.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                      {st.desc}
                    </p>
                  </div>
                </Card>
              ))}
            </div>

            {/* "نصائح للبحث" Box with 4 Clickable Example Chips */}
            <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border/80 space-y-3.5 text-start">
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-text-primary flex items-center gap-2">
                  <Compass className="w-4 h-4 text-primary" />
                  <span>{tData.howToUse.searchTipsTitle}</span>
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {tData.howToUse.searchTipsSubtitle}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {tData.howToUse.searchTips.map((tip, idx) => (
                  <Link
                    key={idx}
                    to={tip.link}
                    className="p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary-tint/30 transition text-start group flex flex-col justify-between"
                  >
                    <span className="font-mono text-xs font-bold text-primary block truncate">
                      {tip.label}
                    </span>
                    <span className="text-[11px] text-text-secondary mt-1 group-hover:text-text-primary transition">
                      {tip.hint}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 6. "الأسئلة الشائعة" (FAQ) SECTION */}
        <section id="faq" className="py-12 md:py-16 px-4 sm:px-6 border-b border-border/50">
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <Badge variant="charcoal" size="sm">
                {tData.faq.sectionTitle}
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {tData.faq.heading}
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                {tData.faq.subtext}
              </p>
            </div>

            {/* Accessible Accordion */}
            <div className="space-y-3 text-start">
              {tData.faq.items.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                const headingId = `faq-heading-${idx}`;
                const panelId = `faq-panel-${idx}`;

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-border bg-surface transition-colors overflow-hidden"
                  >
                    <h3>
                      <button
                        type="button"
                        id={headingId}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 text-start font-semibold text-sm sm:text-base text-text-primary hover:text-primary transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <span>{item.question}</span>
                        <ChevronDown
                          className={cn(
                            'w-4 h-4 text-text-secondary transition-transform duration-200 shrink-0',
                            isOpen && 'rotate-180 text-primary'
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    </h3>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={headingId}
                      hidden={!isOpen}
                      className={cn(
                        'px-4 sm:px-5 pb-4 sm:pb-5 pt-0 text-xs sm:text-sm text-text-secondary leading-relaxed border-t border-border/40',
                        !isOpen && 'hidden'
                      )}
                    >
                      <p className="pt-3">{item.answer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 7. FINAL CTA STRIP */}
        <section className="py-12 md:py-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6 p-8 md:p-12 rounded-3xl bg-surface border border-border shadow-xs">
            <div className="space-y-2 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {tData.cta.title}
              </h2>
              <p className="text-sm sm:text-base text-text-secondary leading-relaxed">
                {tData.cta.subtext}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link to="/register">
                <Button
                  variant="primary"
                  size="md"
                  className="min-h-[44px] px-8 text-sm font-semibold w-full sm:w-auto"
                >
                  {tData.cta.primaryBtn}
                </Button>
              </Link>
              {hasWhatsApp && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-6 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-elevated text-text-primary font-medium text-sm inline-flex items-center justify-center gap-2 transition duration-150 w-full sm:w-auto shadow-2xs"
                >
                  <MessageCircle className="w-4 h-4 text-[#25D366] shrink-0" />
                  <span>{tData.cta.whatsappBtn}</span>
                </a>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 8. SHARED FOOTER */}
      <AppFooter />
    </div>
  );
};

export default LandingPage;

