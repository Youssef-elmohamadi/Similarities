import { CollectionDetail } from '@/types/collection';
import { VerseDifference } from '@/types/comparison';
import { toArabicDigits, formatAyahOrnament } from '@/lib/utils';

export interface ExportPdfOptions {
  color: boolean;
  fontSize: 'normal' | 'large';
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

function highlightVerseDifferences(
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
  const { color, fontSize } = options;
  const isLarge = fontSize === 'large';

  const quranFontSize = isLarge ? '22pt' : '18pt';
  const quranLineHeight = isLarge ? '2.7' : '2.4';
  const bodyFontSize = isLarge ? '11.5pt' : '10pt';
  const heading1Size = isLarge ? '22pt' : '18pt';
  const heading2Size = isLarge ? '15pt' : '13.5pt';

  const orderedVerses = [...(collection.verses || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const comparisons = [...(collection.comparisons || [])];
  const connections = [...(collection.connections || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const notes = [...(collection.notes || [])];

  const baseOrigin = typeof window !== 'undefined' ? window.location.origin : '';
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
  margin: 15mm 12mm 18mm 12mm;
  @bottom-center {
    content: "متشابهات القرآن الكريم — نص المصحف من مشروع تنزيل tanzil.net";
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

.quran-text {
  font-family: 'Amiri Quran', 'Amiri', serif;
  font-size: ${quranFontSize};
  line-height: ${quranLineHeight};
  color: ${color ? '#0F172A' : '#000000'};
  text-align: justify;
  text-align-last: right;
  word-spacing: 2px;
}

.ayah-ornament {
  font-family: 'Amiri Quran', 'Amiri', serif;
  color: ${color ? '#0F5C4A' : '#000000'};
  font-weight: bold;
  display: inline-block;
  padding: 0 4px;
}

.no-break {
  page-break-inside: avoid;
  break-inside: avoid;
}

.cover-header {
  padding: 18px 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  ${color ? 'background: linear-gradient(135deg, #0F5C4A 0%, #16745E 100%); color: #FFFFFF;' : 'background: #FFFFFF; color: #000000; border: 2px solid #000000;'}
}

.cover-header h1 {
  font-size: ${heading1Size};
  font-weight: 700;
  margin-bottom: 6px;
  line-height: 1.3;
}

.cover-header .app-badge {
  font-size: 8.5pt;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  ${color ? 'color: #A7D7C5;' : 'color: #444444;'}
}

.cover-header .desc {
  font-size: 9.5pt;
  margin-top: 8px;
  white-space: pre-wrap;
  line-height: 1.6;
  ${color ? 'color: #E2E8F0;' : 'color: #222222;'}
}

.metadata-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  ${color ? 'border-top: 1px solid rgba(255,255,255,0.25);' : 'border-top: 1px solid #000000;'}
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 8.5pt;
  padding: 3px 8px;
  border-radius: 6px;
  ${color ? 'background: rgba(255,255,255,0.18); color: #FFFFFF;' : 'background: #F0F0F0; color: #000000; border: 1px solid #000000;'}
}

.section-title {
  font-size: ${heading2Size};
  font-weight: 700;
  margin: 20px 0 10px 0;
  padding-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  ${color ? 'color: #0F5C4A; border-bottom: 2px solid #CBD5E1;' : 'color: #000000; border-bottom: 2px solid #000000;'}
}

.section-count {
  font-size: 8.5pt;
  font-weight: normal;
  padding: 2px 8px;
  border-radius: 12px;
  ${color ? 'background: #E2E8F0; color: #475569;' : 'background: #FFFFFF; color: #000000; border: 1px solid #000000;'}
}

.card {
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 12px;
  ${color ? 'background-color: #FFFFFF; border: 1px solid #E2D9C8;' : 'background-color: #FFFFFF; border: 1.5px solid #000000;'}
}

.anchor-card {
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  ${color ? 'background-color: #FEF9EE; border: 1.5px solid #FCD34D;' : 'background-color: #FFFFFF; border: 1.5px solid #000000;'}
}

.parallel-card {
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 8px;
  ${color ? 'background-color: #F8FAFC; border: 1px solid #E2E8F0;' : 'background-color: #FFFFFF; border: 1px solid #444444;'}
}

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

.diff-highlight {
  background-color: #D1FAE5;
  color: #065F46;
  border-bottom: 2px solid #059669;
  border-radius: 3px;
  padding: 0 3px;
}

.diff-highlight-bw {
  text-decoration: underline;
  text-decoration-style: solid;
  font-weight: bold;
  border: 1px solid #000000;
  border-radius: 3px;
  padding: 0 4px;
}

.shared-box {
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
  ${color ? 'background-color: #FEF3C7; border-right: 4px solid #D97706; color: #78350F;' : 'background-color: #FFFFFF; border: 1px solid #000000; border-right: 4px solid #000000; color: #000000;'}
}

.diff-entry {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  ${color ? 'background-color: #F8FAFC; border: 1px solid #E2E8F0; border-right: 3px solid #0F5C4A;' : 'background-color: #FFFFFF; border: 1px solid #000000; border-right: 3px solid #000000;'}
}

.note-box {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 9pt;
  white-space: pre-wrap;
  ${color ? 'background-color: #ECFDF5; border: 1px solid #A7F3D0; border-right: 3px solid #059669; color: #065F46;' : 'background-color: #FFFFFF; border: 1px dashed #000000; border-right: 3px solid #000000; color: #000000;'}
}

.page-footer-note {
  margin-top: 24px;
  padding-top: 10px;
  border-top: 1px solid #E2E8F0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 8pt;
  color: #64748B;
}
</style>
</head>
<body>`;

  // 1. Cover / Header
  html += `<header class="cover-header no-break">
    <div class="app-badge">متشابهات القرآن الكريم — منصة الحفّاظ الخاصة</div>
    <h1><bdi dir="auto">${escapeHtml(collection.title)}</bdi></h1>`;

  if (collection.baseSurahNameArabic) {
    html += `<div style="font-size: 10pt; margin-top: 4px; font-weight: 600;">سورة الأساس: سورة ${escapeHtml(collection.baseSurahNameArabic)}</div>`;
  }

  if (collection.description) {
    html += `<div class="desc"><bdi dir="auto">${escapeHtml(collection.description)}</bdi></div>`;
  }

  html += `<div class="metadata-bar">
    <span class="meta-pill">الآيات: ${toArabicDigits(orderedVerses.length)}</span>
    <span class="meta-pill">المواضع المقارنة: ${toArabicDigits(comparisons.length)}</span>
    <span class="meta-pill">الروابط والتقنيات: ${toArabicDigits(connections.length)}</span>
    <span class="meta-pill">تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}</span>
  </div>
  </header>`;

  // 2. Verses Section (in user's order)
  if (orderedVerses.length > 0) {
    html += `<section>
      <div class="section-title">
        <span>الآيات الكريمة في المجموعة</span>
        <span class="section-count">${toArabicDigits(orderedVerses.length)} آيات</span>
      </div>`;

    for (const cv of orderedVerses) {
      html += `<div class="card no-break">
        <div style="margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <span class="badge badge-teal">سورة ${escapeHtml(cv.surahNameArabic)}</span>
            <span class="badge badge-slate">الآية ${toArabicDigits(cv.ayahNumber)}</span>
          </div>
          <span style="font-size: 8pt; color: ${color ? '#64748B' : '#444444'};">#${toArabicDigits((cv.displayOrder ?? 0) + 1)}</span>
        </div>
        <p class="quran-text">
          ${escapeHtml(cv.uthmaniText)} <span class="ayah-ornament">${formatAyahOrnament(cv.ayahNumber)}</span>
        </p>`;

      if (cv.personalNote) {
        html += `<div class="note-box">
          <div style="font-weight: 600; margin-bottom: 2px;">ملاحظة الآية:</div>
          <bdi dir="auto">${escapeHtml(cv.personalNote)}</bdi>
        </div>`;
      }

      html += `</div>`;
    }
    html += `</section>`;
  }

  // 3. Comparisons Section
  if (comparisons.length > 0) {
    html += `<section>
      <div class="section-title">
        <span>مواضع المتشابهات والفوارق اللفظية</span>
        <span class="section-count">${toArabicDigits(comparisons.length)} مواضع</span>
      </div>`;

    let cmpIdx = 1;
    for (const cmp of comparisons) {
      html += `<div class="card no-break" style="margin-bottom: 14px;">
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
          <div>
            <span class="badge badge-teal">الموضع ${toArabicDigits(cmpIdx++)}</span>
            <h3 style="display: inline-block; font-size: 11pt; font-weight: 700; margin: 0;"><bdi dir="auto">${escapeHtml(cmp.title)}</bdi></h3>
          </div>`;

      if (cmp.differences && cmp.differences.length > 0) {
        html += `<span class="badge badge-gold">${toArabicDigits(cmp.differences.length)} فوارق</span>`;
      }
      html += `</div>`;

      if (cmp.description) {
        html += `<p style="font-size: 9pt; margin-bottom: 8px; color: ${color ? '#475569' : '#222222'};"><bdi dir="auto">${escapeHtml(cmp.description)}</bdi></p>`;
      }

      if (cmp.sharedPhrases) {
        html += `<div class="shared-box">
          <div style="font-size: 8pt; font-weight: 600; margin-bottom: 2px;">الألفاظ والعبارات المشتركة في هذا الموضع:</div>
          <div class="quran-text" style="font-size: ${isLarge ? '16pt' : '14pt'};">« ${escapeHtml(cmp.sharedPhrases)} »</div>
        </div>`;
      }

      // Anchor verse vs other verses
      const cmpVerses = cmp.verses || [];
      const anchorVerse = cmp.anchorQuranVerseId
        ? cmpVerses.find(v => v.quranVerseId === cmp.anchorQuranVerseId)
        : (collection.baseSurahId
          ? cmpVerses.find(v => v.surahNameArabic === collection.baseSurahNameArabic)
          : cmpVerses[0]);

      const otherVerses = cmpVerses.filter(v => v !== anchorVerse);

      if (anchorVerse) {
        const diffsForVerse = (cmp.differences || []).filter(d => d.quranVerseId === anchorVerse.quranVerseId);
        const highlighted = highlightVerseDifferences(anchorVerse.uthmaniText, diffsForVerse, color);

        html += `<div class="anchor-card">
          <div style="margin-bottom: 4px;">
            <span class="badge badge-gold">موضع الأساس (المرجع)</span>
            <span class="badge badge-teal">سورة ${escapeHtml(anchorVerse.surahNameArabic)}</span>
            <span class="badge badge-slate">الآية ${toArabicDigits(anchorVerse.ayahNumber)}</span>
          </div>
          <p class="quran-text">
            ${highlighted} <span class="ayah-ornament">${formatAyahOrnament(anchorVerse.ayahNumber)}</span>
          </p>
        </div>`;
      }

      for (const other of otherVerses) {
        const diffsForVerse = (cmp.differences || []).filter(d => d.quranVerseId === other.quranVerseId);
        const highlighted = highlightVerseDifferences(other.uthmaniText, diffsForVerse, color);

        html += `<div class="parallel-card">
          <div style="margin-bottom: 4px;">
            <span class="badge badge-slate">موضع مقارن</span>
            <span class="badge badge-teal">سورة ${escapeHtml(other.surahNameArabic)}</span>
            <span class="badge badge-slate">الآية ${toArabicDigits(other.ayahNumber)}</span>
          </div>
          <p class="quran-text">
            ${highlighted} <span class="ayah-ornament">${formatAyahOrnament(other.ayahNumber)}</span>
          </p>
        </div>`;
      }

      // Differences list
      if (cmp.differences && cmp.differences.length > 0) {
        html += `<div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed ${color ? '#CBD5E1' : '#000000'};">
          <div style="font-size: 8.5pt; font-weight: 600; margin-bottom: 4px; color: ${color ? '#0F5C4A' : '#000000'};">الفوارق المرصودة وتوجيه الاختلاف:</div>`;

        for (const diff of cmp.differences) {
          html += `<div class="diff-entry">
            <div style="margin-bottom: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="badge badge-gold">سورة ${escapeHtml(diff.surahNameArabic)} [${toArabicDigits(diff.ayahNumber)}]</span>
              <span class="quran-text" style="font-size: 12pt; font-weight: 600; color: ${color ? '#0F5C4A' : '#000000'};">« ${escapeHtml(diff.selectedText)} »</span>
            </div>`;

          if (diff.explanation) {
            html += `<div style="font-size: 8.5pt; color: ${color ? '#334155' : '#111111'};"><bdi dir="auto">${escapeHtml(diff.explanation)}</bdi></div>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
      }

      html += `</div>`;
    }
    html += `</section>`;
  }

  // 4. Connections Section
  if (connections.length > 0) {
    const groups = [
      { key: 'Verbal', label: 'روابط لفظية' },
      { key: 'Contextual', label: 'روابط سياقية وموضوعية' },
      { key: 'Technique', label: 'وسائل وتقنيات الحفظ' },
      { key: 'GeneralNote', label: 'ملاحظات وفوائد عامة' },
    ];

    html += `<section>
      <div class="section-title">
        <span>روابط وتقنيات الحفظ</span>
        <span class="section-count">${toArabicDigits(connections.length)} روابط</span>
      </div>`;

    for (const g of groups) {
      const groupItems = connections.filter(c => (c.type || '').toLowerCase() === g.key.toLowerCase());
      if (groupItems.length === 0) continue;

      html += `<div style="margin-bottom: 10px;">
        <div style="font-size: 10pt; font-weight: 600; margin-bottom: 6px; color: ${color ? '#0F5C4A' : '#000000'};">❖ ${g.label} (${toArabicDigits(groupItems.length)})</div>`;

      for (const item of groupItems) {
        html += `<div class="card no-break" style="padding: 8px 12px; margin-bottom: 6px;">`;
        if (item.title) {
          html += `<div style="font-weight: 600; font-size: 9.5pt; margin-bottom: 2px;"><bdi dir="auto">${escapeHtml(item.title)}</bdi></div>`;
        }
        html += `<div style="white-space: pre-wrap; font-size: 9pt; color: ${color ? '#334155' : '#111111'};"><bdi dir="auto">${escapeHtml(item.content)}</bdi></div>
        </div>`;
      }
      html += `</div>`;
    }
    html += `</section>`;
  }

  // 5. Personal Notes Section
  if (notes.length > 0) {
    html += `<section>
      <div class="section-title">
        <span>الملاحظات العامة والتدبرية</span>
        <span class="section-count">${toArabicDigits(notes.length)} ملاحظات</span>
      </div>`;

    for (const n of notes) {
      html += `<div class="card no-break" style="margin-bottom: 8px; padding: 8px 12px;">
        <div style="font-size: 7.5pt; color: ${color ? '#64748B' : '#555555'}; margin-bottom: 2px;">${new Date(n.createdAt).toLocaleDateString('ar-EG')}</div>
        <div style="white-space: pre-wrap; font-size: 9pt;"><bdi dir="auto">${escapeHtml(n.content)}</bdi></div>
      </div>`;
    }
    html += `</section>`;
  }

  // Running Footer note
  html += `<div class="page-footer-note no-break">
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
        printWindow.document.fonts.ready.then(() => setTimeout(triggerMobilePrint, 350)).catch(() => setTimeout(triggerMobilePrint, 500));
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
    doc.fonts.ready.then(() => setTimeout(triggerDesktopPrint, 300)).catch(() => setTimeout(triggerDesktopPrint, 500));
  } else {
    setTimeout(triggerDesktopPrint, 500);
  }
}
