import { CollectionDetail } from '@/types/collection';
import { VerseDifference } from '@/types/comparison';
import { toArabicDigits, formatAyahOrnament } from '@/lib/utils';

export interface ExportPdfOptions {
  color: boolean;
  fontSize: 'normal' | 'large';
  selectedComparisonIds?: string[];
}

function escapeHtml(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function highlightVerseDifferences(
  uthmaniText: string,
  differences: VerseDifference[],
  color: boolean
): string {
  if (!differences || differences.length === 0 || !uthmaniText) {
    return escapeHtml(uthmaniText);
  }

  const ranges: Array<{ start: number; end: number }> = [];

  for (const diff of differences) {
    const selected = diff.selectedText?.trim();
    const start = diff.startPosition;
    const end = diff.endPosition;
    let matched = false;

    // 1. Try position range if valid
    if (
      start !== undefined &&
      start !== null &&
      end !== undefined &&
      end !== null &&
      start >= 0 &&
      end <= uthmaniText.length &&
      start < end
    ) {
      const slice = uthmaniText.slice(start, end);
      if (slice.trim() === selected || (selected && slice.includes(selected))) {
        ranges.push({ start, end });
        matched = true;
      }
    }

    // 2. Fallback: match selected text if valid
    if (!matched && selected) {
      const idx = uthmaniText.indexOf(selected);
      if (idx >= 0) {
        ranges.push({ start: idx, end: idx + selected.length });
        matched = true;
      }
    }

    if (!matched && selected) {
      console.warn(
        `[PDF Export] Stale highlight position for diff "${selected}" in ayah ${diff.ayahNumber}; fallback to unhighlighted text.`
      );
    }
  }

  if (ranges.length === 0) {
    return escapeHtml(uthmaniText);
  }

  ranges.sort((a, b) => a.start - b.start);

  let result = '';
  let lastIdx = 0;
  const highlightClass = color ? 'diff-highlight' : 'diff-highlight-bw';

  for (const r of ranges) {
    if (r.start < lastIdx) continue; // Skip overlapping
    if (r.start > lastIdx) {
      result += escapeHtml(uthmaniText.slice(lastIdx, r.start));
    }
    result += `<mark class="${highlightClass}">${escapeHtml(uthmaniText.slice(r.start, r.end))}</mark>`;
    lastIdx = r.end;
  }

  if (lastIdx < uthmaniText.length) {
    result += escapeHtml(uthmaniText.slice(lastIdx));
  }

  return result;
}

export function generateCollectionPrintHtml(collection: CollectionDetail, options: ExportPdfOptions): string {
  const { color, fontSize, selectedComparisonIds } = options;
  const isLarge = fontSize === 'large';

  const quranFontSize = isLarge ? '22pt' : '18pt';
  const quranLineHeight = isLarge ? '2.7' : '2.4';
  const bodyFontSize = isLarge ? '11pt' : '10pt';
  const heading1Size = isLarge ? '21pt' : '18pt';
  const heading2Size = isLarge ? '14pt' : '13pt';

  const orderedVerses = [...(collection.verses || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const allComparisons = [...(collection.comparisons || [])];
  const targetComparisons = (selectedComparisonIds && selectedComparisonIds.length > 0)
    ? allComparisons.filter(c => selectedComparisonIds.includes(c.id))
    : allComparisons;

  const connections = [...(collection.connections || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const notes = [...(collection.notes || [])];

  // Map to easily lookup per-verse personal notes from collection.verses
  const verseNotesMap = new Map<number, string>();
  for (const cv of orderedVerses) {
    if (cv.personalNote?.trim()) {
      verseNotesMap.set(cv.quranVerseId, cv.personalNote.trim());
    }
  }

  // Real computed counts
  const subCollectionsCount = targetComparisons.length;
  const uniqueVerseIds = new Set<number>();
  targetComparisons.forEach(c => c.verses?.forEach(v => uniqueVerseIds.add(v.quranVerseId)));
  if (targetComparisons.length === 0) {
    orderedVerses.forEach(v => uniqueVerseIds.add(v.quranVerseId));
  }
  const totalVersesCount = uniqueVerseIds.size || orderedVerses.length;
  const totalDifferencesCount = targetComparisons.reduce((acc, c) => acc + (c.differences?.length || 0), 0);
  const connectionsCount = connections.length;
  const notesCount = notes.length;

  const hasToc = targetComparisons.length >= 2;
  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Avoid duplicating base surah name if title already has it
  const titleHasBaseSurah = collection.baseSurahNameArabic
    ? collection.title.includes(collection.baseSurahNameArabic)
    : false;

  let html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<base href="${baseOrigin}/">
<title>متشابهات - ${escapeHtml(collection.title)}</title>
<link rel="stylesheet" href="/fonts/fonts.css">
<style>
@page {
  size: A4 portrait;
  margin: 14mm 12mm 18mm 12mm;
  @bottom-center {
    content: "متشابهات القرآن الكريم — نص المصحف من مشروع تنزيل tanzil.net";
    font-family: 'IBM Plex Sans Arabic', sans-serif;
    font-size: 8pt;
    color: #64748B;
  }
  @bottom-left {
    content: "صفحة " counter(page);
    font-family: 'IBM Plex Sans Arabic', sans-serif;
    font-size: 8pt;
    color: #64748B;
  }
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  direction: rtl;
  text-align: right;
  font-family: 'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: ${bodyFontSize};
  line-height: 1.6;
  background-color: ${color ? '#FAF7F0' : '#FFFFFF'};
  color: ${color ? '#1E293B' : '#000000'};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  padding: 10px;
}

@media print {
  body {
    background-color: #FFFFFF !important;
    padding: 0 !important;
  }
  .no-print {
    display: none !important;
  }
}

/* Typography & Headings */
h1, h2, h3, .subcol-title, .toc-header, .section-title {
  page-break-after: avoid;
  break-after: avoid;
}

.no-break, .verse-card, .diff-entry, .diff-section, .toc-card, .shared-box, .verse-note-box {
  page-break-inside: avoid;
  break-inside: avoid;
}

.quran-text {
  font-family: 'Amiri Quran', 'Amiri', serif;
  font-size: ${quranFontSize};
  line-height: ${quranLineHeight};
  color: ${color ? '#0F172A' : '#000000'};
  text-align: right;
  overflow: visible;
  font-synthesis: none;
  -webkit-font-smoothing: antialiased;
  word-spacing: 2px;
}

.ayah-ornament {
  font-family: 'Amiri Quran', 'Amiri', serif;
  color: ${color ? '#0F5C4A' : '#000000'};
  font-weight: bold;
  display: inline-block;
  padding: 0 4px;
}

/* Cover Header */
.cover-header {
  padding: 16px 18px;
  border-radius: 12px;
  margin-bottom: 16px;
  ${color ? 'background: linear-gradient(135deg, #0F5C4A 0%, #16745E 100%); color: #FFFFFF;' : 'background: #FFFFFF; color: #000000; border: 2px solid #000000;'}
}

.cover-header .app-badge {
  font-size: 8.5pt;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  ${color ? 'color: #A7D7C5;' : 'color: #444444;'}
}

.cover-header h1 {
  font-size: ${heading1Size};
  font-weight: 700;
  margin-bottom: 4px;
  line-height: 1.3;
}

.cover-header .base-surah-tag {
  font-size: 9.5pt;
  margin-top: 4px;
  font-weight: 600;
  ${color ? 'color: #F0FDF4;' : 'color: #222222;'}
}

.cover-header .desc {
  font-size: 9pt;
  margin-top: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  ${color ? 'color: #E2E8F0;' : 'color: #222222;'}
}

.metadata-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  padding-top: 8px;
  ${color ? 'border-top: 1px solid rgba(255,255,255,0.25);' : 'border-top: 1px solid #000000;'}
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 8pt;
  padding: 2.5px 7.5px;
  border-radius: 5px;
  ${color ? 'background: rgba(255,255,255,0.18); color: #FFFFFF;' : 'background: #F0F0F0; color: #000000; border: 1px solid #000000;'}
}

/* Table of Contents */
.toc-card {
  padding: 14px 16px;
  border-radius: 10px;
  margin-bottom: 20px;
  ${color ? 'background: #FFFFFF; border: 1.5px solid #E2D9C8;' : 'background: #FFFFFF; border: 1.5px solid #000000;'}
}

.toc-header {
  font-size: 11pt;
  font-weight: 700;
  margin-bottom: 10px;
  padding-bottom: 4px;
  ${color ? 'color: #0F5C4A; border-bottom: 1.5px solid #E2E8F0;' : 'color: #000000; border-bottom: 1.5px solid #000000;'}
}

.toc-row {
  display: flex;
  align-items: baseline;
  padding: 4px 0;
  font-size: 9pt;
  border-bottom: 1px dotted ${color ? '#CBD5E1' : '#CCCCCC'};
}

.toc-row:last-child {
  border-bottom: none;
}

.toc-idx {
  font-weight: 700;
  min-width: 22px;
  ${color ? 'color: #0F5C4A;' : 'color: #000000;'}
}

.toc-title {
  font-weight: 600;
  flex: 0 1 auto;
}

.toc-filler {
  flex: 1 1 auto;
  border-bottom: 1px dotted ${color ? '#94A3B8' : '#777777'};
  margin: 0 8px;
  height: 1px;
}

.toc-count {
  font-size: 8pt;
  font-weight: normal;
  white-space: nowrap;
  ${color ? 'color: #64748B;' : 'color: #444444;'}
}

/* Sub-Collection Sections */
.subcollection-section {
  page-break-before: always;
  break-before: page;
  margin-bottom: 20px;
}

.subcollection-section.first-subcol-no-break {
  page-break-before: auto !important;
  break-before: auto !important;
}

.subcol-header {
  margin-bottom: 12px;
  padding-bottom: 8px;
  ${color ? 'border-bottom: 2px solid #0F5C4A;' : 'border-bottom: 2px solid #000000;'}
}

.subcol-title {
  font-size: ${heading2Size};
  font-weight: 700;
  line-height: 1.35;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  ${color ? 'color: #0F5C4A;' : 'color: #000000;'}
}

.subcol-index {
  margin-inline-end: 4px;
}

.subcol-badges {
  display: inline-flex;
  gap: 6px;
  font-size: 8pt;
  font-weight: normal;
}

.subcol-desc {
  font-size: 8.5pt;
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  ${color ? 'color: #475569;' : 'color: #222222;'}
}

/* Badges */
.badge {
  display: inline-block;
  font-size: 8pt;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  margin-inline-end: 6px;
}

.badge-gold {
  ${color ? 'background-color: #FEF3C7; color: #92400E; border: 1px solid #FCD34D;' : 'background-color: #FFFFFF; color: #000000; border: 1.5px solid #000000;'}
}

.badge-teal {
  ${color ? 'background-color: #CCFBF1; color: #115E59; border: 1px solid #99F6E4;' : 'background-color: #FFFFFF; color: #000000; border: 1px solid #000000;'}
}

.badge-slate {
  ${color ? 'background-color: #F1F5F9; color: #475569; border: 1px solid #CBD5E1;' : 'background-color: #FFFFFF; color: #333333; border: 1px dashed #666666;'}
}

/* Shared Phrases Box */
.shared-box {
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  ${color ? 'background-color: #FEF3C7; border-right: 4px solid #D97706; color: #78350F;' : 'background-color: #FFFFFF; border: 1px solid #000000; border-right: 4px solid #000000; color: #000000;'}
}

.shared-label {
  font-size: 8pt;
  font-weight: 600;
  margin-bottom: 2px;
}

.shared-text {
  font-size: ${isLarge ? '15pt' : '13.5pt'} !important;
}

/* Verse Cards */
.verse-card {
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
}

.anchor-card {
  ${color ? 'background-color: #FEF9EE; border: 1.5px solid #FCD34D;' : 'background-color: #FFFFFF; border: 1.5px solid #000000;'}
}

.parallel-card {
  ${color ? 'background-color: #F8FAFC; border: 1px solid #E2E8F0;' : 'background-color: #FFFFFF; border: 1px solid #444444;'}
}

.verse-header {
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.verse-note-box {
  margin-top: 6px;
  padding: 5px 8px;
  border-radius: 5px;
  font-size: 8.5pt;
  white-space: pre-wrap;
  word-break: break-word;
  ${color ? 'background-color: #ECFDF5; border: 1px solid #A7F3D0; border-right: 3px solid #059669; color: #065F46;' : 'background-color: #FFFFFF; border: 1px dashed #000000; border-right: 3px solid #000000; color: #000000;'}
}

.note-label {
  font-weight: 700;
  margin-inline-end: 4px;
}

/* Differences & Explanations */
.diff-section {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed ${color ? '#CBD5E1' : '#000000'};
}

.diff-header-title {
  font-size: 8.5pt;
  font-weight: 700;
  margin-bottom: 6px;
  ${color ? 'color: #0F5C4A;' : 'color: #000000;'}
}

.diff-entry {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  ${color ? 'background-color: #F8FAFC; border: 1px solid #E2E8F0; border-right: 3px solid #0F5C4A;' : 'background-color: #FFFFFF; border: 1px solid #000000; border-right: 3px solid #000000;'}
}

.diff-text {
  font-size: 11.5pt !important;
  font-weight: 700;
  ${color ? 'color: #0F5C4A;' : 'color: #000000;'}
}

.diff-expl {
  font-size: 8.5pt;
  margin-top: 3px;
  white-space: pre-wrap;
  word-break: break-word;
  ${color ? 'color: #334155;' : 'color: #111111;'}
}

/* Highlights */
.diff-highlight {
  background-color: #D1FAE5;
  color: #065F46;
  border-bottom: 2px solid #059669;
  border-radius: 3px;
  padding: 0 3px;
}

.diff-highlight-bw {
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  font-weight: bold;
  border: 1px solid #000000;
  border-radius: 3px;
  padding: 0 4px;
  background-color: transparent !important;
  color: #000000 !important;
}

/* Empty Sub-Collection Notice */
.empty-subcol-notice {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 8.5pt;
  text-align: center;
  ${color ? 'background-color: #F1F5F9; color: #64748B; border: 1px dashed #CBD5E1;' : 'background-color: #FFFFFF; color: #444444; border: 1px dashed #000000;'}
}

/* General Notes & Connections Section */
.collection-general-section {
  margin-top: 24px;
  padding-top: 14px;
  ${color ? 'border-top: 2px solid #CBD5E1;' : 'border-top: 2px solid #000000;'}
}

.print-footer-line {
  margin-top: 24px;
  padding-top: 8px;
  border-top: 1px solid #E2E8F0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 7.5pt;
  color: #64748B;
}
</style>
</head>
<body class="${hasToc ? 'has-toc' : 'no-toc'}">`;

  // 1. Cover / Header (Compact)
  html += `<header class="cover-header no-break">
    <div class="app-badge">متشابهات القرآن الكريم — منصة الحفّاظ الخاصة</div>
    <h1><bdi dir="auto">${escapeHtml(collection.title)}</bdi></h1>`;

  if (collection.baseSurahNameArabic && !titleHasBaseSurah) {
    html += `<div class="base-surah-tag">سورة الأساس: سورة ${escapeHtml(collection.baseSurahNameArabic)}</div>`;
  }

  if (collection.description) {
    html += `<div class="desc"><bdi dir="auto">${escapeHtml(collection.description)}</bdi></div>`;
  }

  html += `<div class="metadata-bar">`;
  if (subCollectionsCount > 0) {
    html += `<span class="meta-pill">المواضع الفرعية: ${toArabicDigits(subCollectionsCount)}</span>`;
  }
  if (totalVersesCount > 0) {
    html += `<span class="meta-pill">إجمالي الآيات: ${toArabicDigits(totalVersesCount)}</span>`;
  }
  if (totalDifferencesCount > 0) {
    html += `<span class="meta-pill">الفوارق المرصودة: ${toArabicDigits(totalDifferencesCount)}</span>`;
  }
  if (connectionsCount > 0) {
    html += `<span class="meta-pill">روابط الحفظ: ${toArabicDigits(connectionsCount)}</span>`;
  }
  if (notesCount > 0) {
    html += `<span class="meta-pill">الملاحظات: ${toArabicDigits(notesCount)}</span>`;
  }
  html += `<span class="meta-pill">تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}</span>`;
  html += `</div>
  </header>`;

  // 2. Table of Contents (when 2 or more sub-collections)
  if (hasToc) {
    html += `<nav class="toc-card no-break">
      <div class="toc-header">فهرس مواضع المتشابهات (${toArabicDigits(targetComparisons.length)})</div>
      <div class="toc-list">`;

    targetComparisons.forEach((cmp, idx) => {
      const vCount = cmp.verses?.length || 0;
      html += `<div class="toc-row">
        <span class="toc-idx">${toArabicDigits(idx + 1)}.</span>
        <span class="toc-title"><bdi dir="auto">${escapeHtml(cmp.title)}</bdi></span>
        <span class="toc-filler"></span>
        <span class="toc-count">${toArabicDigits(vCount)} ${vCount === 1 ? 'آية' : vCount === 2 ? 'آيتان' : 'آيات'}</span>
      </div>`;
    });

    html += `</div></nav>`;
  }

  // 3. Sub-Collections (Each as its own independent section)
  targetComparisons.forEach((cmp, idx) => {
    const isFirstNoToc = idx === 0 && !hasToc;
    const vCount = cmp.verses?.length || 0;
    const dCount = cmp.differences?.length || 0;
    const isEmpty = vCount === 0 && dCount === 0 && !cmp.description;

    html += `<section class="subcollection-section ${isFirstNoToc ? 'first-subcol-no-break' : ''}">
      <div class="subcol-header no-break">
        <h2 class="subcol-title">
          <span>
            <span class="subcol-index">الموضع ${toArabicDigits(idx + 1)}:</span>
            <bdi dir="auto">${escapeHtml(cmp.title)}</bdi>
          </span>
          <span class="subcol-badges">
            <span class="badge badge-teal">${toArabicDigits(vCount)} آيات</span>
            ${dCount > 0 ? `<span class="badge badge-gold">${toArabicDigits(dCount)} فوارق</span>` : ''}
          </span>
        </h2>`;

    if (cmp.description) {
      html += `<p class="subcol-desc"><bdi dir="auto">${escapeHtml(cmp.description)}</bdi></p>`;
    }
    html += `</div>`;

    if (isEmpty) {
      html += `<div class="empty-subcol-notice no-break">هذا الموضع فارغ ولا يحتوي على آيات أو فوارق مسجلة بعد.</div>`;
    } else {
      // Shared phrases
      if (cmp.sharedPhrases) {
        html += `<div class="shared-box no-break">
          <div class="shared-label">الألفاظ والعبارات المشتركة في هذا الموضع:</div>
          <div class="quran-text shared-text">« ${escapeHtml(cmp.sharedPhrases)} »</div>
        </div>`;
      }

      // Verses
      const cmpVerses = cmp.verses || [];
      const anchorVerse = cmp.anchorQuranVerseId
        ? cmpVerses.find(v => v.quranVerseId === cmp.anchorQuranVerseId)
        : (collection.baseSurahId
          ? cmpVerses.find(v => v.surahNameArabic === collection.baseSurahNameArabic)
          : cmpVerses[0]);

      const otherVerses = cmpVerses.filter(v => v !== anchorVerse);

      // Anchor verse
      if (anchorVerse) {
        const diffsForVerse = (cmp.differences || []).filter(d => d.quranVerseId === anchorVerse.quranVerseId);
        const highlighted = highlightVerseDifferences(anchorVerse.uthmaniText, diffsForVerse, color);
        const personalNote = verseNotesMap.get(anchorVerse.quranVerseId);

        html += `<div class="verse-card anchor-card no-break">
          <div class="verse-header">
            <span class="badge badge-gold">موضع الأساس (المرجع)</span>
            <span class="badge badge-teal">سورة ${escapeHtml(anchorVerse.surahNameArabic)}</span>
            <span class="badge badge-slate">الآية ${toArabicDigits(anchorVerse.ayahNumber)}</span>
          </div>
          <p class="quran-text" dir="rtl" lang="ar">
            ${highlighted} <span class="ayah-ornament">${formatAyahOrnament(anchorVerse.ayahNumber)}</span>
          </p>`;

        if (personalNote) {
          html += `<div class="verse-note-box">
            <span class="note-label">ملاحظة الآية:</span>
            <bdi dir="auto">${escapeHtml(personalNote)}</bdi>
          </div>`;
        }

        html += `</div>`;
      }

      // Comparative verses
      for (const other of otherVerses) {
        const diffsForVerse = (cmp.differences || []).filter(d => d.quranVerseId === other.quranVerseId);
        const highlighted = highlightVerseDifferences(other.uthmaniText, diffsForVerse, color);
        const personalNote = verseNotesMap.get(other.quranVerseId);

        html += `<div class="verse-card parallel-card no-break">
          <div class="verse-header">
            <span class="badge badge-slate">موضع مقارن</span>
            <span class="badge badge-teal">سورة ${escapeHtml(other.surahNameArabic)}</span>
            <span class="badge badge-slate">الآية ${toArabicDigits(other.ayahNumber)}</span>
          </div>
          <p class="quran-text" dir="rtl" lang="ar">
            ${highlighted} <span class="ayah-ornament">${formatAyahOrnament(other.ayahNumber)}</span>
          </p>`;

        if (personalNote) {
          html += `<div class="verse-note-box">
            <span class="note-label">ملاحظة الآية:</span>
            <bdi dir="auto">${escapeHtml(personalNote)}</bdi>
          </div>`;
        }

        html += `</div>`;
      }

      // Differences list with explanations
      if (cmp.differences && cmp.differences.length > 0) {
        html += `<div class="diff-section no-break">
          <div class="diff-header-title">الفوارق المرصودة وتوجيه الاختلاف لهذا الموضع:</div>`;

        for (const diff of cmp.differences) {
          html += `<div class="diff-entry">
            <div style="margin-bottom: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="badge badge-gold">سورة ${escapeHtml(diff.surahNameArabic)} [${toArabicDigits(diff.ayahNumber)}]</span>
              <span class="quran-text diff-text">« ${escapeHtml(diff.selectedText)} »</span>
            </div>`;

          if (diff.explanation) {
            html += `<div class="diff-expl"><bdi dir="auto">${escapeHtml(diff.explanation)}</bdi></div>`;
          }
          html += `</div>`;
        }

        html += `</div>`;
      }
    }

    html += `</section>`;
  });

  // 4. Standalone Verses (Verses in collection not part of any comparison, if any)
  if (targetComparisons.length === 0 && orderedVerses.length > 0) {
    html += `<section class="subcollection-section first-subcol-no-break">
      <div class="subcol-header no-break">
        <h2 class="subcol-title">
          <span>الآيات الكريمة في المجموعة</span>
          <span class="subcol-badges">
            <span class="badge badge-teal">${toArabicDigits(orderedVerses.length)} آيات</span>
          </span>
        </h2>
      </div>`;

    for (const cv of orderedVerses) {
      html += `<div class="verse-card parallel-card no-break">
        <div class="verse-header">
          <span class="badge badge-teal">سورة ${escapeHtml(cv.surahNameArabic)}</span>
          <span class="badge badge-slate">الآية ${toArabicDigits(cv.ayahNumber)}</span>
        </div>
        <p class="quran-text" dir="rtl" lang="ar">
          ${escapeHtml(cv.uthmaniText)} <span class="ayah-ornament">${formatAyahOrnament(cv.ayahNumber)}</span>
        </p>`;

      if (cv.personalNote) {
        html += `<div class="verse-note-box">
          <span class="note-label">ملاحظة الآية:</span>
          <bdi dir="auto">${escapeHtml(cv.personalNote)}</bdi>
        </div>`;
      }

      html += `</div>`;
    }

    html += `</section>`;
  }

  // 5. Collection-Level Items (General Notes & Memorization Connections)
  if (connections.length > 0 || notes.length > 0) {
    html += `<section class="subcollection-section collection-general-section">
      <div class="subcol-header no-break">
        <h2 class="subcol-title">ملاحظات وروابط عامة على المجموعة</h2>
      </div>`;

    if (connections.length > 0) {
      const groups = [
        { key: 'Verbal', label: 'روابط لفظية' },
        { key: 'Contextual', label: 'روابط سياقية وموضوعية' },
        { key: 'Technique', label: 'وسائل وتقنيات الحفظ' },
        { key: 'GeneralNote', label: 'ملاحظات وفوائد عامة' },
      ];

      for (const g of groups) {
        const groupItems = connections.filter(c => (c.type || '').toLowerCase() === g.key.toLowerCase());
        if (groupItems.length === 0) continue;

        html += `<div style="margin-bottom: 10px;" class="no-break">
          <div style="font-size: 9.5pt; font-weight: 700; margin-bottom: 5px; color: ${color ? '#0F5C4A' : '#000000'};">❖ ${g.label} (${toArabicDigits(groupItems.length)})</div>`;

        for (const item of groupItems) {
          html += `<div class="verse-card parallel-card no-break" style="padding: 7px 10px; margin-bottom: 5px;">`;
          if (item.title) {
            html += `<div style="font-weight: 700; font-size: 9pt; margin-bottom: 2px;"><bdi dir="auto">${escapeHtml(item.title)}</bdi></div>`;
          }
          html += `<div style="white-space: pre-wrap; word-break: break-word; font-size: 8.5pt; color: ${color ? '#334155' : '#111111'};"><bdi dir="auto">${escapeHtml(item.content)}</bdi></div>
          </div>`;
        }
        html += `</div>`;
      }
    }

    if (notes.length > 0) {
      html += `<div style="margin-top: 10px;" class="no-break">
        <div style="font-size: 9.5pt; font-weight: 700; margin-bottom: 5px; color: ${color ? '#0F5C4A' : '#000000'};">ملاحظات الحافظ العامة (${toArabicDigits(notes.length)})</div>`;

      for (const n of notes) {
        html += `<div class="verse-card parallel-card no-break" style="margin-bottom: 6px; padding: 7px 10px;">
          <div style="font-size: 7.5pt; color: ${color ? '#64748B' : '#555555'}; margin-bottom: 2px;">${new Date(n.createdAt).toLocaleDateString('ar-EG')}</div>
          <div style="white-space: pre-wrap; word-break: break-word; font-size: 8.5pt;"><bdi dir="auto">${escapeHtml(n.content)}</bdi></div>
        </div>`;
      }
      html += `</div>`;
    }

    html += `</section>`;
  }

  // Footer Note
  html += `<div class="print-footer-line no-break">
    <span>متشابهات القرآن الكريم — منصة الحفّاظ الخاصة</span>
    <span>نص المصحف من مشروع تنزيل tanzil.net</span>
  </div>`;

  html += `</body></html>`;
  return html;
}

export function exportCollectionToPdf(collection: CollectionDetail, options: ExportPdfOptions): void {
  const html = generateCollectionPrintHtml(collection, options);
  const isMobile = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  // On mobile devices, opening a new window ensures the native OS print / share dialog pops reliably
  if (isMobile) {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      const triggerMobilePrint = () => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (err) {
          console.error('Mobile print failed:', err);
        }
      };

      if (printWindow.document.fonts && printWindow.document.fonts.ready) {
        printWindow.document.fonts.ready
          .then(() => setTimeout(triggerMobilePrint, 350))
          .catch(() => setTimeout(triggerMobilePrint, 500));
      } else {
        setTimeout(triggerMobilePrint, 500);
      }
      return;
    }
  }

  // Desktop: hidden iframe prints directly without popup interruption
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('title', 'PDF Export Preview');

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerDesktopPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error('Desktop print failed:', err);
    } finally {
      setTimeout(() => {
        iframe.remove();
      }, 3000);
    }
  };

  if (doc.fonts && doc.fonts.ready) {
    doc.fonts.ready
      .then(() => setTimeout(triggerDesktopPrint, 300))
      .catch(() => setTimeout(triggerDesktopPrint, 500));
  } else {
    setTimeout(triggerDesktopPrint, 500);
  }
}
