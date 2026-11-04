// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChatDisclaimers } from './ChatDisclaimers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('ChatDisclaimers', () => {
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
  });

  it('renders both mandatory religious and external AI privacy disclaimers', () => {
    act(() => {
      root.render(<ChatDisclaimers compact={false} />);
    });

    // Religious disclaimer
    expect(container.textContent).toContain('مساعد تجريبي قد يُخطئ، راجع أهل العلم ولا تعتمد عليه في فهم كلام الله');

    // Privacy disclaimer
    expect(container.textContent).toContain('رسائلك تُرسل إلى خدمة ذكاء اصطناعي خارجية، ولا تكتب بيانات شخصية');
  });

  it('renders compact mode with core warning', () => {
    act(() => {
      root.render(<ChatDisclaimers compact={true} />);
    });

    expect(container.textContent).toContain('مساعد تجريبي قد يُخطئ، راجع أهل العلم ولا تعتمد عليه في فهم كلام الله');
  });
});
