/**
 * Mobile UI Density Design Tokens (< 768px)
 * Single source of truth for mobile compact, calm layouts.
 * 
 * Rules:
 * - Desktop (>= 768px) remains visually unchanged.
 * - Minimum touch target >= 44px on all mobile interactive elements.
 * - Unified single border (border-border), zero elevation/shadows on mobile.
 * - Logical Tailwind properties only (ms-, me-, ps-, pe-, start-, end-).
 */

export const mobileDensity = {
  // Navigation & Bars
  topBarHeight: 'h-14 md:h-16',
  bottomNavHeight: 'h-14',
  stickyTabTop: 'top-14',
  tabBarHeight: 'h-10 md:h-11',
  
  // Layout Spacing
  pagePadding: 'px-3 sm:px-6 lg:px-8',
  pageBottomPadding: 'pb-28 md:pb-12', // Clearance for bottom nav (56px) + FAB (48px) + safe area
  blockGap: 'space-y-2.5 md:space-y-6',
  containerPadding: 'p-3 md:p-5',
  
  // Containers & Cards
  card: 'bg-surface border border-border rounded-xl shadow-none md:shadow-xs p-3 md:p-5 text-start',
  compactCard: 'bg-surface border border-border rounded-xl shadow-none p-3 text-start',
  dividedList: 'divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden',
  
  // List Row Dimensions
  listRowMinHeight: 'min-h-[52px]',
  listRowPadding: 'py-2 px-3',
  touchTarget: 'min-h-[44px] min-w-[44px]',
  
  // Form Controls
  inputHeight: 'h-10 md:h-11',
  buttonHeight: 'h-10 md:h-11',
  fabSize: 'w-12 h-12', // 48px touch target
  badgeSize: 'w-6 h-6', // 24px number badge
  
  // Typography Hierarchy
  pageTitle: 'text-base md:text-2xl font-bold text-text-primary leading-tight',
  sectionTitle: 'text-sm md:text-lg font-semibold text-text-primary leading-snug',
  bodyText: 'text-xs md:text-sm text-text-secondary leading-relaxed',
  metaText: 'text-[11px] md:text-xs text-text-secondary',
  statsText: 'text-xs md:text-sm text-text-secondary font-medium',
  
  // Verse Typography (Invariable Tanzil Standard)
  verseFont: 'font-quran tracking-normal',
} as const;

