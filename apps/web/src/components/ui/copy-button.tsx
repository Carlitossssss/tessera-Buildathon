'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  value: string;
  label?: string;
  size?: 'sm' | 'md';
  variant?: 'secondary' | 'outline' | 'primary' | 'ghost';
}

export function CopyButton({ value, label = 'Copiar', size = 'sm', variant = 'secondary' }: Props) {
  const [copied, setCopied] = useState(false);

  const handle = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop: en navegadores antiguos / sin permisos
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handle}
      aria-label={copied ? 'Copiado' : label}
      className="inline-flex items-center gap-1.5"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
      {copied ? 'Copiado' : label}
    </Button>
  );
}
