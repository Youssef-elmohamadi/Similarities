/**
 * Cooperative scheduling utilities to prevent main-thread long tasks
 * and maintain Interaction to Next Paint (INP) < 200ms.
 */

declare global {
  interface Window {
    scheduler?: {
      yield?: () => Promise<void>;
    };
  }
}

/**
 * Yield control to the browser main thread to allow pending inputs,
 * styles, layouts, and paints to process smoothly.
 */
export async function yieldToMain(): Promise<void> {
  if (typeof window !== 'undefined' && window.scheduler?.yield) {
    return window.scheduler.yield();
  }
  return new Promise(resolve => {
    if (typeof requestAnimationFrame !== 'undefined') {
      setTimeout(resolve, 0);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

/**
 * Schedule non-critical work during browser idle periods.
 */
export function runWhenIdle(callback: () => void, timeout: number = 2000): void {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 50);
  }
}

