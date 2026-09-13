import type { Metadata } from 'next';
import { publicEnv } from '@/lib/env';
import { StatusView, type HealthPayload } from './status-view';

export const metadata: Metadata = {
  title: 'Estado del servicio',
  description: 'Estado operativo de Tessera y sus dependencias principales.',
};

export const dynamic = 'force-dynamic';

async function fetchHealth(): Promise<HealthPayload | null> {
  try {
    const base = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/v1/health`, { cache: 'no-store' });
    return (await res.json().catch(() => null)) as HealthPayload | null;
  } catch {
    return null;
  }
}

export default async function StatusPage() {
  const health = await fetchHealth();
  return <StatusView health={health} />;
}
