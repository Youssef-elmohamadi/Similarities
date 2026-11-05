import React from 'react';
import { VerseTokenChip } from './VerseTokenChip';

interface SanitizedMarkdownProps {
  content: string;
}

// Safely sanitize content by stripping raw HTML tags
function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Returns the safe-to-render portion of streaming text by stripping any
 * trailing partial [[...]] token that has been opened but not yet closed.
 */
export function bufferPartialTokens(text: string): string {
  const lastOpen = text.lastIndexOf('[[');
  const lastClose = text.lastIndexOf(']]');
  if (lastOpen > lastClose) {
    // There's an unclosed [[ at the end — buffer it
    return text.substring(0, lastOpen);
  }
  return text;
}

// Parse inline formatting: bold, italic, inline code, verse tokens, and src tokens
function renderInlineText(text: string, keyPrefix: string): React.ReactNode[] {
  // Regex group mapping:
  // Group 1 (full match wrapper)
  // Group 2: verse surah  [[v:(\d+):(\d+)(?:#([0-9-]+))?]]
  // Group 3: verse ayah
  // Group 4: verse word range (optional)
  // Group 5: bold inner  \*\*([^*]+)\*\*
  // Group 6: code inner  `([^`]+)`
  // Group 7: italic inner  \*([^*]+)\*
  // Group 8: src token id  \[\[src:([A-Za-z0-9_\-]+)\]\]
  const pattern =
    /(\[\[v:(\d+):(\d+)(?:#([0-9-]+))?\]\]|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*|\[\[src:([A-Za-z0-9_\-]+)\]\])/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = pattern.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = pattern.lastIndex;

    if (matchStart > lastIndex) {
      elements.push(
        <span key={`${keyPrefix}-txt-${counter++}`}>
          {text.substring(lastIndex, matchStart)}
        </span>
      );
    }

    const fullMatch = match[0];

    if (fullMatch.startsWith('[[v:')) {
      // Verse token
      const surahNum = parseInt(match[2], 10);
      const ayahNum = parseInt(match[3], 10);
      const wordRange = match[4];
      elements.push(
        <VerseTokenChip
          key={`${keyPrefix}-verse-${counter++}`}
          surahNumber={surahNum}
          ayahNumber={ayahNum}
          wordRange={wordRange}
        />
      );
    } else if (fullMatch.startsWith('[[src:')) {
      // Source badge token
      const srcId = match[8];
      elements.push(
        <span
          key={`${keyPrefix}-src-${counter++}`}
          className="inline-flex items-center gap-0.5 text-[10px] text-text-muted border border-border/50 rounded px-1 py-0.5"
        >
          <span>مصدر {srcId}</span>
        </span>
      );
    } else if (fullMatch.startsWith('**')) {
      // Bold — recursively parse inner content to catch verse tokens inside bold
      elements.push(
        <strong key={`${keyPrefix}-b-${counter++}`} className="font-bold text-text-primary">
          {renderInlineText(match[5], `${keyPrefix}-b-${counter}`)}
        </strong>
      );
    } else if (fullMatch.startsWith('`')) {
      // Inline code
      elements.push(
        <code
          key={`${keyPrefix}-code-${counter++}`}
          className="px-1.5 py-0.5 rounded bg-background border border-border text-xs font-mono text-primary font-medium"
        >
          {match[6]}
        </code>
      );
    } else if (fullMatch.startsWith('*')) {
      // Italic — recursively parse inner content to catch verse tokens inside italic
      elements.push(
        <em key={`${keyPrefix}-i-${counter++}`} className="italic text-text-secondary">
          {renderInlineText(match[7], `${keyPrefix}-i-${counter}`)}
        </em>
      );
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    elements.push(
      <span key={`${keyPrefix}-txt-${counter++}`}>
        {text.substring(lastIndex)}
      </span>
    );
  }

  return elements;
}

export const SanitizedMarkdown: React.FC<SanitizedMarkdownProps> = ({ content }) => {
  if (!content) return null;

  // 1. Strip raw HTML
  const sanitized = stripHtmlTags(content);

  // 2. Split into block lines
  const lines = sanitized.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentList: { ordered: boolean; items: string[] } | null = null;
  let codeBlockBuffer: string[] | null = null;

  const flushList = (key: string) => {
    if (!currentList) return;
    const isOrdered = currentList.ordered;
    const items = [...currentList.items];
    currentList = null;

    if (isOrdered) {
      blocks.push(
        <ol key={key} className="list-decimal list-inside space-y-1 my-2 ps-2 text-text-primary text-sm md:text-base leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx} className="my-0.5">
              {renderInlineText(it, `${key}-li-${idx}`)}
            </li>
          ))}
        </ol>
      );
    } else {
      blocks.push(
        <ul key={key} className="list-disc list-inside space-y-1 my-2 ps-2 text-text-primary text-sm md:text-base leading-relaxed">
          {items.map((it, idx) => (
            <li key={idx} className="my-0.5">
              {renderInlineText(it, `${key}-ul-${idx}`)}
            </li>
          ))}
        </ul>
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Check code blocks ```
    if (trimmed.startsWith('```')) {
      if (codeBlockBuffer === null) {
        flushList(`list-before-code-${i}`);
        codeBlockBuffer = [];
      } else {
        const codeText = codeBlockBuffer.join('\n');
        blocks.push(
          <pre
            key={`pre-${i}`}
            className="p-3 my-2 rounded-xl bg-charcoal-900 text-charcoal-100 dark:bg-charcoal-950 font-mono text-xs overflow-x-auto text-start dir-ltr"
          >
            <code>{codeText}</code>
          </pre>
        );
        codeBlockBuffer = null;
      }
      continue;
    }

    if (codeBlockBuffer !== null) {
      codeBlockBuffer.push(rawLine);
      continue;
    }

    // Blank line
    if (!trimmed) {
      flushList(`list-blank-${i}`);
      continue;
    }

    // Headings
    if (trimmed.startsWith('### ')) {
      flushList(`list-before-h3-${i}`);
      blocks.push(
        <h3 key={`h3-${i}`} className="text-base md:text-lg font-bold text-text-primary mt-3 mb-1.5">
          {renderInlineText(trimmed.substring(4), `h3-${i}`)}
        </h3>
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushList(`list-before-h2-${i}`);
      blocks.push(
        <h2 key={`h2-${i}`} className="text-lg md:text-xl font-bold text-text-primary mt-4 mb-2">
          {renderInlineText(trimmed.substring(3), `h2-${i}`)}
        </h2>
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      flushList(`list-before-h1-${i}`);
      blocks.push(
        <h1 key={`h1-${i}`} className="text-xl md:text-2xl font-bold text-text-primary mt-4 mb-2">
          {renderInlineText(trimmed.substring(2), `h1-${i}`)}
        </h1>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList(`list-before-quote-${i}`);
      blocks.push(
        <blockquote
          key={`quote-${i}`}
          className="border-s-4 border-primary/50 ps-3 py-1 my-2 text-text-secondary bg-primary/5 rounded-e-lg text-sm italic"
        >
          {renderInlineText(trimmed.substring(2), `quote-${i}`)}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const itemText = trimmed.substring(2);
      if (!currentList || currentList.ordered) {
        flushList(`list-switch-${i}`);
        currentList = { ordered: false, items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Ordered list (e.g. "1. ")
    const orderedMatch = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    if (orderedMatch) {
      const itemText = orderedMatch[2];
      if (!currentList || !currentList.ordered) {
        flushList(`list-switch-ord-${i}`);
        currentList = { ordered: true, items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Regular paragraph
    flushList(`list-para-${i}`);
    blocks.push(
      <p key={`p-${i}`} className="my-1.5 leading-relaxed text-sm md:text-base text-text-primary">
        {renderInlineText(rawLine, `p-${i}`)}
      </p>
    );
  }

  flushList('list-end');

  return <div className="space-y-0.5 leading-relaxed select-text">{blocks}</div>;
};
