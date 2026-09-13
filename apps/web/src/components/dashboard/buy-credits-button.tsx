'use client';

import { useState, useTransition } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { buyCreditsAction } from '@/app/(app)/institution/actions';
import { Button } from '@/components/ui/button';

interface BuyCreditsButtonProps {
  bundleCode: string;
  label?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}

export function BuyCreditsButton({
  bundleCode,
  label = 'Comprar',
  variant = 'primary',
  className,
}: BuyCreditsButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onClick() {
    setErr(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('bundleCode', bundleCode);
      const result = await buyCreditsAction(fd);
      if (!result.ok) {
        setErr(result.error);
        return;
      }
        window.location.assign(result.data!.checkoutUrl);
    });
  }

  return (
    <div className={className}>
      <Button
        variant={variant === 'primary' ? 'primary' : 'secondary'}
        onClick={onClick}
        disabled={isPending}
        className="w-full justify-center gap-2"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Abriendo Stripe Checkout…
          </>
        ) : (
          <>
            <ShoppingCart className="h-4 w-4" />
            {label}
          </>
        )}
      </Button>
      {err && <p className="mt-2 text-xs text-[var(--color-danger-500)]">{err}</p>}
    </div>
  );
}
