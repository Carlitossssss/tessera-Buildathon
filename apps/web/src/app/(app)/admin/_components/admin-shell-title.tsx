'use client';

import { useT } from '@tessera/i18n';

/**
 * Admin shell title and description.
 *
 * A separate component because the layout is a server component: converting
 * the whole thing to client for two phrases would cost more than it solves.
 */
export function AdminShellTitle({ part }: { part: 'title' | 'description' }) {
  const t = useT();
  return <>{part === 'title' ? t.admin.layout.title : t.admin.layout.description}</>;
}
