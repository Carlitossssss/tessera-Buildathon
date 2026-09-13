import { publicEnv } from '@/lib/env';
import { AdminHealthView } from './admin-health-view';

export const dynamic = 'force-dynamic';

type HealthPayload = {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptimeMs: number;
  responseMs: number;
  version: string;
  checks: Record<string, string>;
  blockchain: { network: string; blockNumber: string } | null;
};

async function fetchHealth(): Promise<HealthPayload | null> {
  try {
    const base = publicEnv.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
    const res = await fetch(`${base}/v1/health`, { cache: 'no-store' });
    const payload = (await res.json().catch(() => null)) as HealthPayload | null;
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

export default async function AdminHealthPage() {
  const health = (await fetchHealth()) ?? {
    status: 'degraded' as const,
    timestamp: new Date().toISOString(),
    uptimeMs: 0,
    responseMs: 0,
    version: 'dev',
    checks: {},
    blockchain: null,
  };

  return <AdminHealthView health={health} />;
}

