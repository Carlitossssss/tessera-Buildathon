import { AutoRefresh } from './auto-refresh';

interface RefreshWhileSuspendedProps {
  active: boolean;
  intervalMs?: number;
}

export function RefreshWhileSuspended({ active, intervalMs = 8000 }: RefreshWhileSuspendedProps) {
  return <AutoRefresh active={active} intervalMs={intervalMs} />;
}
