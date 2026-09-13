'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  active?: boolean;
  intervalMs?: number;
  pauseOnFormActivity?: boolean;
}

function isEditableElement(element: Element | null) {
  if (!element) return false;
  if (element instanceof HTMLInputElement) {
    return ![
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit',
    ].includes(element.type);
  }
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLFormElement ||
    element.getAttribute('contenteditable') === 'true'
  );
}

export function AutoRefresh({
  active = true,
  intervalMs = 10000,
  pauseOnFormActivity = true,
}: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const dirtyForms = new Set<HTMLFormElement>();
    let editingWithoutFormUntil = 0;

    const pruneDirtyForms = () => {
      for (const form of Array.from(dirtyForms)) {
        if (!document.contains(form)) dirtyForms.delete(form);
      }
    };

    const shouldPause = () => {
      if (!pauseOnFormActivity) return false;
      pruneDirtyForms();
      if (dirtyForms.size > 0) return true;
      if (Date.now() < editingWithoutFormUntil) return true;
      return isEditableElement(document.activeElement);
    };

    const refresh = () => {
      if (!shouldPause()) router.refresh();
    };

    const markDirty = (event: Event) => {
      if (!pauseOnFormActivity) return;
      const target = event.target instanceof Element ? event.target : null;
      if (!isEditableElement(target)) return;
      const form = target?.closest('form');
      if (form) {
        dirtyForms.add(form);
        return;
      }
      editingWithoutFormUntil = Date.now() + 60_000;
    };

    const clearDirty = (event: Event) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (form) dirtyForms.delete(form);
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalMs);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('input', markDirty, true);
    document.addEventListener('change', markDirty, true);
    document.addEventListener('submit', clearDirty, true);
    document.addEventListener('reset', clearDirty, true);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('input', markDirty, true);
      document.removeEventListener('change', markDirty, true);
      document.removeEventListener('submit', clearDirty, true);
      document.removeEventListener('reset', clearDirty, true);
    };
  }, [active, intervalMs, pauseOnFormActivity, router]);

  return null;
}
