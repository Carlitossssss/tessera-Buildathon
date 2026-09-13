'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export function SavedStatus({ show, label }: { show: boolean; label: string }) {
  const [visible, setVisible] = useState(show);
  const router = useRouter();

  useEffect(() => {
    setVisible(show);
    if (!show) return;
    const timer = window.setTimeout(() => {
      setVisible(false);
      router.replace('/admin/plans', { scroll: false });
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [router, show]);

  return (
    <span className="min-h-5 text-sm font-medium text-[var(--color-accent-400)]">
      {visible ? label : ''}
    </span>
  );
}
