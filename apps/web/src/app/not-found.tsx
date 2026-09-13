'use client';

import { useT } from '@tessera/i18n';

export default function NotFound() {
  const t = useT();
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, margin: 0 }}>404</h1>
        <p style={{ color: '#6b7280' }}>{t.common.notFound}</p>
      </div>
    </main>
  );
}
