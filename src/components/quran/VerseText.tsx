import React from 'react';
import { formatAyahOrnament, tokenizeQuranText } from '@/lib/utils';
import { cn } from '@/lib/utils';

export interface VerseTextProps {
  uthmaniText: string;
  ayahNumber?: number;
  highlightedIndices?: number[];
  highlightedPhrase?: string;
  className?: string;
  showOrnament?: boolean;
}

export const VerseText: React.FC<VerseTextProps> = ({
  uthmaniText,
  ayahNumber,
  highlightedIndices = [],
  highlightedPhrase,
  className,
  showOrnament = true,
}) => {
  const words = tokenizeQuranText(uthmaniText);

  // If a phrase is passed, calculate matched indices based on word tokens
  let effectiveIndices = [...highlightedIndices];
  if (highlightedPhrase && effectiveIndices.length === 0) {
    const phraseTokens = tokenizeQuranText(highlightedPhrase);
    if (phraseTokens.length > 0) {
      for (let i = 0; i <= words.length - phraseTokens.length; i++) {
        let match = true;
        for (let j = 0; j < phraseTokens.length; j++) {
          if (words[i + j] !== phraseTokens[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          for (let j = 0; j < phraseTokens.length; j++) {
            effectiveIndices.push(i + j + 1); // 1-based index
          }
          break;
        }
      }
    }
  }

  return (
    <span
      dir="rtl"
      lang="ar"
      className={cn(
        'font-quran selection:bg-accent-tint text-start inline',
        className
      )}
    >
      {effectiveIndices.length > 0 ? (
        words.map((word, idx) => {
          const isHighlighted = effectiveIndices.includes(idx + 1);
          return (
            <React.Fragment key={idx}>
              {idx > 0 && ' '}
              {isHighlighted ? (
                <mark className="bg-[#F6EEDC] dark:bg-amber-950/40 text-inherit px-1 py-0.5 rounded border-b border-primary/50 inline">
                  {word}
                </mark>
              ) : (
                word
              )}
            </React.Fragment>
          );
        })
      ) : (
        <span>{uthmaniText}</span>
      )}

      {showOrnament && typeof ayahNumber === 'number' && (
        <span
          className="ayah-number-badge text-primary font-bold ms-1 select-none inline text-base md:text-lg align-baseline"
          aria-label={`آية ${ayahNumber}`}
        >
          {formatAyahOrnament(ayahNumber)}
        </span>
      )}
    </span>
  );
};

