'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface CourseOption {
  id: string;
  title: string;
}

export function StudentsFilterBar({
  courses,
  search,
  courseId,
}: {
  courses: CourseOption[];
  search: string;
  courseId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(search);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId);

  const targetUrl = useMemo(() => {
    const params = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed) params.set('search', trimmed);
    if (selectedCourseId) params.set('courseId', selectedCourseId);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, query, selectedCourseId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(targetUrl, { scroll: false });
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [router, targetUrl]);

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)_auto] sm:items-end">
      <div className="space-y-1">
        <label className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Buscar
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white/[0.03] px-3 py-2.5">
          <Search className="h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre o correo"
            className="w-full bg-transparent text-[13.5px] text-[var(--color-fg)] outline-none placeholder:text-[var(--color-fg-subtle)]"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
          Curso
        </label>
        <Select
          value={selectedCourseId}
          onChange={(event) => setSelectedCourseId(event.target.value)}
          className="h-11 px-3 py-2.5 text-[13.5px]"
          aria-label="Filtrar por curso"
        >
          <option value="">Todos</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center gap-2">
        {pending ? (
          <span className="text-xs text-[var(--color-fg-subtle)]">Actualizando…</span>
        ) : null}
        <Button asChild size="md">
          <Link href="/teacher/students">Limpiar</Link>
        </Button>
      </div>
    </div>
  );
}
