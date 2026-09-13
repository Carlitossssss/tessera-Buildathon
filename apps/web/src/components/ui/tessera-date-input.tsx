'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function TesseraDateInput({
  value,
  onChange,
  invalid = false,
  title,
  id,
  className,
  maxDate,
  yearNavigation = false,
  placeholder = 'AAAA-MM-DD',
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  title?: string;
  id?: string;
  className?: string;
  maxDate?: string;
  yearNavigation?: boolean;
  placeholder?: string;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;
  const max = maxDate ?? formatIsoDate(new Date());
  const [month, setMonth] = useState(() => selected ?? new Date());

  useEffect(() => {
    const nextSelected = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : null;
    if (nextSelected) setMonth(nextSelected);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const days = useMemo(() => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const count = new Date(year, monthIndex + 1, 0).getDate();
    return [...Array(firstWeekday).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [month]);

  function toggleCalendar() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top:
          rect.bottom + 326 <= window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - 326),
        left: Math.max(8, Math.min(window.innerWidth - 288, rect.left)),
      });
    }
    setOpen((current) => !current);
  }

  const currentMonthIsMax =
    month.getFullYear() === Number(max.slice(0, 4)) &&
    month.getMonth() + 1 === Number(max.slice(5, 7));
  const maxYear = Number(max.slice(0, 4));
  const minYear = maxYear - 120;
  const selectedYear = month.getFullYear();

  return (
    <div ref={triggerRef} className="relative">
      <Input
        id={id}
        value={value}
        invalid={invalid}
        title={title}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={10}
        onChange={(event) => {
          const next = formatDateDigits(event.target.value);
          if (next.length < 10 || next <= max) onChange(next);
        }}
        className={cn('h-8 border-blue-300/15 bg-[#081127] pr-9 font-mono text-[12px]', className)}
      />
      <button
        type="button"
        onClick={toggleCalendar}
        title="Abrir calendario"
        aria-label="Abrir calendario"
        className="absolute right-1 top-1/2 grid h-6 w-7 -translate-y-1/2 place-items-center rounded-md text-[var(--color-brand-300)] hover:bg-white/[0.06]"
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed z-[100] w-[280px] rounded-xl border border-blue-300/15 bg-[#071024] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            style={position}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-fg-muted)] hover:bg-white/[0.06]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {yearNavigation ? (
                <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold capitalize text-[var(--color-fg)]">
                    {month.toLocaleDateString('es', { month: 'long' })}
                  </p>
                  <select
                    aria-label="Seleccionar año"
                    value={selectedYear}
                    onChange={(event) => {
                      const nextYear = Number(event.target.value);
                      const nextMonth =
                        nextYear === maxYear
                          ? Math.min(month.getMonth(), Number(max.slice(5, 7)) - 1)
                          : month.getMonth();
                      setMonth(new Date(nextYear, nextMonth, 1));
                    }}
                    className="h-7 rounded-md border border-blue-300/15 bg-[#081127] px-2 text-xs font-semibold text-[var(--color-fg)] outline-none focus:border-[var(--color-brand-400)]"
                  >
                    {Array.from(
                      { length: maxYear - minYear + 1 },
                      (_, index) => maxYear - index,
                    ).map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm font-semibold capitalize text-[var(--color-fg)]">
                  {month.toLocaleDateString('es', { month: 'long', year: 'numeric' })}
                </p>
              )}
              <button
                type="button"
                disabled={currentMonthIsMax}
                onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                className="grid h-7 w-7 place-items-center rounded-md text-[var(--color-fg-muted)] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-[var(--color-fg-subtle)]">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} />;
                const date = new Date(month.getFullYear(), month.getMonth(), day);
                const iso = formatIsoDate(date);
                const active = iso === value;
                const future = iso > max;
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={future}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={cn(
                      'grid h-8 place-items-center rounded-md text-xs transition disabled:cursor-not-allowed disabled:opacity-25',
                      active
                        ? 'bg-[var(--color-brand-500)] text-white'
                        : 'text-[var(--color-fg-muted)] hover:bg-white/[0.07] hover:text-[var(--color-fg)]',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function formatDateDigits(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join('-');
}

function formatIsoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
