'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { TesseraDateInput } from '@/components/ui/tessera-date-input';
import { cn } from '@/lib/utils';
import { acceptNumericValue, inferTabularFieldKind } from '@/lib/validation/tabular-fields';

export function TabularFieldInput({
  column,
  value,
  onChange,
  error,
  readOnly = false,
}: {
  column: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}) {
  const kind = inferTabularFieldKind(column);
  const common = {
    value,
    invalid: Boolean(error),
    title: error,
    className: 'h-8 text-[13px]',
  };

  if (kind === 'date') {
    return <TesseraDateInput {...common} onChange={onChange} />;
  }

  if (kind === 'score') {
    return (
      <Input
        {...common}
        type="text"
        readOnly={readOnly}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={3}
        onChange={(event) => {
          const accepted = acceptNumericValue(event.target.value);
          if (accepted !== null) onChange(accepted);
        }}
      />
    );
  }

  if (kind === 'wallet') {
    return (
      <Input
        {...common}
        type="text"
        readOnly={readOnly}
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="0x1234..."
        className={cn(
          'h-8 font-mono text-[12px]',
          readOnly && 'cursor-not-allowed bg-white/[0.035] text-[var(--color-fg-muted)]',
        )}
        onChange={(event) => onChange(event.target.value.trim())}
      />
    );
  }

  return (
    <Input
      {...common}
      type={kind === 'email' ? 'email' : 'text'}
      readOnly={readOnly}
      spellCheck={kind === 'text'}
      className={cn(
        common.className,
        readOnly && 'cursor-not-allowed bg-white/[0.035] text-[var(--color-fg-muted)]',
      )}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function EditableColumnHeader({
  name,
  onRename,
  onRemove,
  required = false,
}: {
  name: string;
  onRename: (currentName: string, nextName: string) => void;
  onRemove: (name: string) => void;
  required?: boolean;
}) {
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);

  return (
    <div className="flex items-center gap-1">
      <div className="flex min-w-28 items-center gap-1">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={() => {
            onRename(name, value);
            if (!value.trim()) setValue(name);
          }}
          onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          aria-label={`Nombre de columna ${name}`}
          className="h-7 w-full bg-transparent px-2 text-[11px] font-semibold uppercase"
        />
        {required ? (
          <span className="text-sm font-semibold leading-none text-red-300">
            *
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onRemove(name)}
        title={`Quitar columna ${name}`}
        aria-label={`Quitar columna ${name}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--color-fg-subtle)] transition hover:bg-red-500/10 hover:text-red-300"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
