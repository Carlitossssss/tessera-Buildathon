'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@tessera/i18n';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

interface UsersFilterBarProps {
  q?: string;
  role?: string;
  status?: string;
}

export function UsersFilterBar({ q = '', role = '', status = '' }: UsersFilterBarProps) {
  const t = useT();
  const copy = t.admin.users.filters;
  const ROLE_OPTIONS = [
    ['institution_admin', copy.roles.institutionAdmin],
    ['admin', copy.roles.admin],
    ['api_client', copy.roles.apiClient],
    ['teacher', copy.roles.teacher],
    ['student', copy.roles.student],
  ] as const;
  const STATUS_OPTIONS = [
    ['active', copy.statuses.active],
    ['deleted', copy.statuses.deleted],
    ['profile_incomplete', copy.statuses.profileIncomplete],
    ['profile_pending', copy.statuses.profilePending],
    ['profile_rejected', copy.statuses.profileRejected],
    ['restricted', copy.statuses.restricted],
  ] as const;
  const [query, setQuery] = useState(q);
  const [selectedRole, setSelectedRole] = useState(role);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function apply(next: { q?: string; role?: string; status?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const values = {
      q: next.q ?? query,
      role: next.role ?? selectedRole,
      status: next.status ?? selectedStatus,
    };

    Object.entries(values).forEach(([key, value]) => {
      const clean = value.trim();
      if (clean) params.set(key, clean);
      else params.delete(key);
    });
    params.delete('page');

    const suffix = params.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  }

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (query !== q) apply({ q: query });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, q]);

  useEffect(() => setSelectedRole(role), [role]);
  useEffect(() => setSelectedStatus(status), [status]);

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-white/[0.02] p-4 md:grid-cols-[1fr_180px_180px_auto]">
      <input
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={copy.searchPlaceholder}
        className="h-10 rounded-xl border border-[var(--color-border)] bg-white/[0.03] px-3 text-sm text-[var(--color-fg)] outline-none transition focus:border-[var(--color-brand-400)]"
      />
      <Select
        name="role"
        value={selectedRole}
        onChange={(event) => {
          setSelectedRole(event.target.value);
          apply({ role: event.target.value });
        }}
        className="h-10 px-3 py-2 text-sm"
      >
        <option value="">{copy.allRoles}</option>
        {ROLE_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        name="status"
        value={selectedStatus}
        onChange={(event) => {
          setSelectedStatus(event.target.value);
          apply({ status: event.target.value });
        }}
        className="h-10 px-3 py-2 text-sm"
      >
        <option value="">{copy.allStatuses}</option>
        {STATUS_OPTIONS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Button asChild size="sm">
        <Link href="/admin/users">{copy.clear}</Link>
      </Button>
    </div>
  );
}
