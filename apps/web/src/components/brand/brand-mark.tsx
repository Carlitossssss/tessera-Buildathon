import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandMarkProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}

export function BrandMark({ size = 32, className, withWordmark = true }: BrandMarkProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Image
        src="/tessera-icon.png"
        alt=""
        width={size}
        height={size}
        aria-hidden
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
      {withWordmark ? (
        <span className="text-base font-semibold tracking-tight text-[var(--color-fg)]">Tessera.</span>
      ) : null}
    </span>
  );
}
