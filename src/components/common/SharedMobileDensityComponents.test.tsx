// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ListRow } from './ListRow';
import { OverflowMenu } from './OverflowMenu';
import { SegmentedTabs } from './SegmentedTabs';
import { FAB } from './FAB';
import { StatsLine } from './StatsLine';
import { SectionToolbar } from './SectionToolbar';
import { BottomSheet } from './BottomSheet';
import { LanguageProvider } from '@/context/LanguageContext';
import { MemoryRouter } from 'react-router-dom';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('Shared Mobile Density Components', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
  });

  describe('ListRow', () => {
    it('renders collapsed row with min-h-[52px], title, subtitle, and badge', () => {
      act(() => {
        root.render(
          <LanguageProvider>
            <ListRow
              index={1}
              title="سورة البقرة"
              subtitle="آية الكرسي"
              meta="منذ ساعة"
            />
          </LanguageProvider>
        );
      });

      const row = container.querySelector('.min-h-\\[52px\\]');
      expect(row).not.toBeNull();
      expect(row?.textContent).toContain('سورة البقرة');
      expect(row?.textContent).toContain('آية الكرسي');
      expect(row?.textContent).toContain('منذ ساعة');
    });

    it('toggles accordion expansion in place with role button and aria-expanded', () => {
      const toggleFn = vi.fn();
      act(() => {
        root.render(
          <LanguageProvider>
            <ListRow
              index={1}
              title="موضع تشابه"
              isExpanded={false}
              onToggleExpand={toggleFn}
            >
              <div id="expanded-content">المحتوى المفصل للآية الكريمة</div>
            </ListRow>
          </LanguageProvider>
        );
      });

      const clickable = container.querySelector('[role="button"]') as HTMLElement;
      expect(clickable).not.toBeNull();
      expect(clickable.getAttribute('aria-expanded')).toBe('false');
      expect(container.querySelector('#expanded-content')).toBeNull();

      act(() => {
        clickable.click();
      });
      expect(toggleFn).toHaveBeenCalledTimes(1);
    });

    it('supports keyboard expansion via Enter key', () => {
      const toggleFn = vi.fn();
      act(() => {
        root.render(
          <LanguageProvider>
            <ListRow
              title="موضع تجريبي"
              isExpanded={false}
              onToggleExpand={toggleFn}
            >
              <div>محتوى</div>
            </ListRow>
          </LanguageProvider>
        );
      });

      const clickable = container.querySelector('[role="button"]') as HTMLElement;
      act(() => {
        clickable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      expect(toggleFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('OverflowMenu', () => {
    it('opens dropdown menu on click with >=44px trigger and accessible attributes', () => {
      const editFn = vi.fn();
      const deleteFn = vi.fn();

      act(() => {
        root.render(
          <LanguageProvider>
            <OverflowMenu
              ariaLabel="خيارات الموضع"
              items={[
                { label: 'تعديل', onClick: editFn },
                { label: 'حذف', onClick: deleteFn, variant: 'danger' },
              ]}
            />
          </LanguageProvider>
        );
      });

      const triggerBtn = container.querySelector('button[aria-label="خيارات الموضع"]') as HTMLButtonElement;
      expect(triggerBtn).not.toBeNull();
      expect(triggerBtn.getAttribute('aria-haspopup')).toBe('menu');
      expect(triggerBtn.getAttribute('aria-expanded')).toBe('false');

      act(() => {
        triggerBtn.click();
      });

      expect(triggerBtn.getAttribute('aria-expanded')).toBe('true');
      const menu = container.querySelector('[role="menu"]');
      expect(menu).not.toBeNull();

      const menuItems = menu?.querySelectorAll('[role="menuitem"]');
      expect(menuItems?.length).toBe(2);

      act(() => {
        (menuItems?.[0] as HTMLButtonElement).click();
      });
      expect(editFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('SegmentedTabs', () => {
    it('renders segmented tabs with counts in parentheses and sticky top bar', () => {
      const changeFn = vi.fn();
      act(() => {
        root.render(
          <LanguageProvider>
            <SegmentedTabs
              tabs={[
                { id: 'tab-1', label: 'المواضع', count: 8 },
                { id: 'tab-2', label: 'الروابط', count: 4 },
              ]}
              activeTab="tab-1"
              onChange={changeFn}
            />
          </LanguageProvider>
        );
      });

      const tablist = container.querySelector('[role="tablist"]');
      expect(tablist).not.toBeNull();

      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(2);
      expect(tabs[0].getAttribute('aria-selected')).toBe('true');
      expect(tabs[0].textContent).toContain('المواضع (٨)');

      act(() => {
        (tabs[1] as HTMLButtonElement).click();
      });
      expect(changeFn).toHaveBeenCalledWith('tab-2');
    });
  });

  describe('FAB', () => {
    it('renders floating action button positioned above bottom nav at bottom-20 end-4', () => {
      act(() => {
        root.render(
          <MemoryRouter>
            <FAB
              to="/collections/new"
              ariaLabel="إضافة جديدة"
            />
          </MemoryRouter>
        );
      });

      const fab = container.querySelector('a[aria-label="إضافة جديدة"]');
      expect(fab).not.toBeNull();
      expect(fab?.className).toContain('bottom-20');
      expect(fab?.className).toContain('end-4');
      expect(fab?.className).toContain('w-12'); // 48px touch target
      expect(fab?.className).toContain('h-12');
    });
  });

  describe('StatsLine', () => {
    it('renders inline stats separated by dots with status icon', () => {
      act(() => {
        root.render(
          <LanguageProvider>
            <StatsLine
              items={[
                { label: 'مواضع', count: 5 },
                { label: 'روابط', count: 2 },
              ]}
              status="saved"
            />
          </LanguageProvider>
        );
      });

      expect(container.textContent).toContain('٥ مواضع');
      expect(container.textContent).toContain('·');
      expect(container.textContent).toContain('٢ روابط');
      // Status icon present
      expect(container.querySelector('[aria-label="محفوظ ومحدث"]')).not.toBeNull();
    });
  });

  describe('SectionToolbar', () => {
    it('renders title, count, and single action button in one compact row', () => {
      const actionFn = vi.fn();
      act(() => {
        root.render(
          <LanguageProvider>
            <SectionToolbar
              title="مواضع السورة"
              count={7}
              action={{
                label: 'فتح الكل',
                onClick: actionFn,
              }}
            />
          </LanguageProvider>
        );
      });

      expect(container.textContent).toContain('مواضع السورة');
      expect(container.textContent).toContain('(٧)');
      const btn = container.querySelector('button') as HTMLButtonElement;
      expect(btn).not.toBeNull();
      expect(btn.textContent).toContain('فتح الكل');

      act(() => {
        btn.click();
      });
      expect(actionFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('BottomSheet', () => {
    it('renders slide-up sheet on document body with close button and ESC dismissal', () => {
      const closeFn = vi.fn();
      act(() => {
        root.render(
          <BottomSheet isOpen={true} onClose={closeFn} title="خيارات الفرز">
            <div id="sheet-body">خيارات الفرز هنا</div>
          </BottomSheet>
        );
      });

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(document.querySelector('#sheet-body')?.textContent).toContain('خيارات الفرز هنا');

      const closeBtn = dialog?.querySelector('button[aria-label="إغلاق النافذة"]') as HTMLButtonElement;
      act(() => {
        closeBtn.click();
      });
      expect(closeFn).toHaveBeenCalledTimes(1);
    });
  });
});

