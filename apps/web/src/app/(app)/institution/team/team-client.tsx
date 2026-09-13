'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  AlertCircle,
  Check,
  Crown,
  Eye,
  GraduationCap,
  Mail,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatDate } from '@/lib/format';
import {
  inviteTeamMemberAction,
  removeTeamMemberAction,
  updateTeamMemberRoleAction,
} from '../actions';
import { ConfirmationDialog } from '../../admin/confirmation-dialog';

export type MemberRole = 'admin' | 'teacher' | 'reviewer';
const ASSIGNABLE_ROLES: Exclude<MemberRole, 'admin'>[] = ['teacher', 'reviewer'];

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  memberRole: string;
  createdAt: string;
  avatarUrl: string | null;
  walletAddress: string | null;
  profileStatus: 'incomplete' | 'pending' | 'approved' | 'rejected' | null;
  firstName: string | null;
  lastName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  birthDate: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  addressLine: string | null;
  profileCompletedAt: string | null;
  profileSubmittedAt: string | null;
  profileApprovedAt: string | null;
}

interface TeamInvitationHistory {
  id: string;
  email: string;
  name: string | null;
  memberRole: string;
  courseId: string | null;
  courseTitle: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
}

interface Props {
  initial: TeamMember[];
  initialInvitations: TeamInvitationHistory[];
  invitationsPagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  currentUserId: string;
}

const ROLE_META: Record<MemberRole, { label: string; icon: React.ElementType; help: string }> = {
  admin: {
    label: 'Admin',
    icon: Crown,
    help: 'Acceso total: equipo, plan, API keys, certificados, configuración.',
  },
  teacher: {
    label: 'Docente',
    icon: GraduationCap,
    help: 'Emite certificados y badges, gestiona cursos y estudiantes.',
  },
  reviewer: {
    label: 'Revisor',
    icon: Eye,
    help: 'Solo lectura: panel, certificados emitidos, analíticas.',
  },
};

const ROLE_VARIANTS: Record<MemberRole, 'brand' | 'accent' | 'default'> = {
  admin: 'brand',
  teacher: 'accent',
  reviewer: 'default',
};

const PROFILE_STATUS_META = {
  incomplete: { label: 'Perfil incompleto', variant: 'warning' as const },
  pending: { label: 'Perfil pendiente', variant: 'brand' as const },
  approved: { label: 'Perfil aprobado', variant: 'success' as const },
  rejected: { label: 'Perfil rechazado', variant: 'danger' as const },
};

function initials(name?: string | null, email?: string) {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return parts.length >= 2
    ? (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

function normalizeRole(role: string): MemberRole {
  const r = role.toLowerCase();
  if (r === 'admin' || r === 'owner') return 'admin';
  if (r === 'reviewer') return 'reviewer';
  return 'teacher';
}

function invitationStatus(invitation: TeamInvitationHistory) {
  if (invitation.acceptedAt) {
    return { label: 'Aceptada', variant: 'success' as const };
  }
  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    return { label: 'Expirada', variant: 'default' as const };
  }
  return { label: 'Pendiente', variant: 'warning' as const };
}

function invitationsPageHref(page: number) {
  const params = new URLSearchParams();
  params.set('invitesPage', String(page));
  return `/institution/team?${params.toString()}`;
}

function profileStatusMeta(status: TeamMember['profileStatus']) {
  return status ? PROFILE_STATUS_META[status] : null;
}

function FieldView({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white/[0.025] p-3">
      <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-[var(--color-fg-subtle)]">
        {label}
      </p>
      <p className="mt-1 truncate text-[13px] text-[var(--color-fg)]" title={value || '—'}>
        {value || '—'}
      </p>
    </div>
  );
}

export function TeamClient({
  initial,
  initialInvitations,
  invitationsPagination,
  currentUserId,
}: Props) {
  const [members, setMembers] = useState(initial);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [viewingMember, setViewingMember] = useState<TeamMember | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [created, setCreated] = useState<{
    email: string;
    name: string | null;
    memberRole: string;
    existingUser: boolean;
    inviteUrl: string | null;
  } | null>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function showToast(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }

  function handleInvite(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await inviteTeamMemberAction(form);
      if (res.ok && res.data) {
        const invitation = res.data;
        setOpen(false);
        setCreated({
          email: invitation.email,
          name: invitation.name,
          memberRole: invitation.memberRole,
          existingUser: invitation.existingUser,
          inviteUrl: invitation.inviteUrl,
        });
        setInvitations((prev) => [
          {
            id: invitation.invitationId,
            email: invitation.email,
            name: invitation.name,
            memberRole: invitation.memberRole,
            courseId: invitation.courseId,
            courseTitle: invitation.courseTitle,
            expiresAt: invitation.expiresAt,
            acceptedAt: null,
            createdAt: invitation.createdAt,
            createdByEmail: null,
            createdByName: null,
          },
          ...prev,
        ]);
        showToast('ok', `Invitación enviada a ${invitation.email}`);
      } else if (!res.ok) {
        setError(res.error);
      }
    });
  }

  function handleRoleChange(memberId: string, memberRole: MemberRole) {
    setPendingId(memberId);
    startTransition(async () => {
      const res = await updateTeamMemberRoleAction(memberId, memberRole);
      setPendingId(null);
      if (res.ok) {
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, memberRole } : m)));
        showToast('ok', 'Rol actualizado');
      } else {
        showToast('err', res.error);
      }
    });
  }

  function closeRemoveDialog() {
    if (pendingId) return;
    setMemberToRemove(null);
  }

  function handleRemove() {
    if (!memberToRemove) return;
    const memberId = memberToRemove.id;
    setPendingId(memberId);
    startTransition(async () => {
      const res = await removeTeamMemberAction(memberId);
      setPendingId(null);
      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== memberId));
        setMemberToRemove(null);
        showToast('ok', 'Miembro removido del equipo');
      } else {
        showToast('err', res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed right-6 top-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-2xl backdrop-blur ${
            toast.kind === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              : 'border-red-500/40 bg-red-500/15 text-red-200'
          }`}
          role="status"
        >
          {toast.kind === 'ok' ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {toast.text}
        </div>
      )}

      {/* Acción primaria + lista */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-[var(--color-fg-muted)]">
          {members.length} {members.length === 1 ? 'persona' : 'personas'} con acceso
        </div>
        <Button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5">
          <UserPlus className="h-4 w-4" />
          Invitar miembro
        </Button>
      </div>

      {/* Lista */}
      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
        {members.map((m) => {
          const role = normalizeRole(m.memberRole);
          const meta = ROLE_META[role];
          const isMe = m.userId === currentUserId;
          const isBusy = pendingId === m.id;
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4 transition hover:bg-white/[0.02]"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-brand-700)]/30 font-mono text-sm font-semibold text-[var(--color-brand-300)]">
                {initials(m.name, m.email)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-[var(--color-fg)]">
                    {m.name || m.email}
                  </p>
                  {isMe && <Badge variant="default">Tú</Badge>}
                </div>
                <p className="truncate text-xs text-[var(--color-fg-subtle)]">{m.email}</p>
              </div>

              {/* Selector de rol */}
              <div className="flex items-center gap-2">
                <Select
                  value={role}
                  onChange={(e) => handleRoleChange(m.id, e.target.value as MemberRole)}
                  disabled={isBusy || isMe || role === 'admin'}
                  className="h-9 min-w-[118px] px-2 py-1 text-xs disabled:opacity-50"
                  aria-label="Rol del miembro"
                  title={
                    role === 'admin'
                      ? 'El rol admin no se puede cambiar desde este selector'
                      : isMe
                        ? 'No puedes cambiar tu propio rol'
                        : meta.help
                  }
                >
                  {role === 'admin' && <option value="admin">Admin</option>}
                  <option value="teacher">Docente</option>
                  <option value="reviewer">Revisor</option>
                </Select>
                <Badge variant={ROLE_VARIANTS[role]}>{meta.label}</Badge>
              </div>

              <p className="hidden text-right text-xs text-[var(--color-fg-subtle)] md:block">
                Desde {formatDate(m.createdAt)}
              </p>

              {!isMe ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewingMember(m)}
                  className="inline-flex items-center gap-1.5"
                >
                  <Eye className="h-4 w-4" />
                  Ver
                </Button>
              ) : null}

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMemberToRemove(m)}
                disabled={isBusy || isMe}
                aria-label="Quitar del equipo"
                title={isMe ? 'No puedes quitarte a ti mismo' : 'Quitar del equipo'}
                className="text-[var(--color-fg-subtle)] hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <ConfirmationDialog
        open={Boolean(memberToRemove)}
        kind="remove-team-member"
        pending={Boolean(memberToRemove && pendingId === memberToRemove.id)}
        selectedName={memberToRemove?.name || memberToRemove?.email || 'Integrante'}
        selectedDetail={memberToRemove?.email ?? ''}
        onClose={closeRemoveDialog}
        onConfirm={handleRemove}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--color-fg)]">
              Historial de invitaciones
            </h3>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              Seguimiento de invitaciones enviadas por email y su estado de aceptación.
            </p>
          </div>
          <Badge variant="default">
            {invitationsPagination.total} {invitationsPagination.total === 1 ? 'enviada' : 'enviadas'}
          </Badge>
        </header>

        {invitations.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <Mail className="mx-auto h-6 w-6 text-[var(--color-fg-subtle)]" />
            <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
              Todavía no hay invitaciones por email.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
                <tr className="border-b border-[var(--color-border)]">
                  <th className="px-5 py-3 font-medium">Invitado</th>
                  <th className="px-5 py-3 font-medium">Rol</th>
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Enviada</th>
                  <th className="px-5 py-3 font-medium">Aceptada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/70">
                {invitations.map((invitation) => {
                  const role = normalizeRole(invitation.memberRole);
                  const status = invitationStatus(invitation);
                  return (
                    <tr key={invitation.id} className="transition hover:bg-white/[0.02]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-brand-700)]/25 font-mono text-xs font-semibold text-[var(--color-brand-300)]">
                            {initials(invitation.name, invitation.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[13.5px] font-medium text-[var(--color-fg)]">
                              {invitation.name || invitation.email}
                            </p>
                            <p className="truncate text-xs text-[var(--color-fg-subtle)]">
                              {invitation.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={ROLE_VARIANTS[role]}>{ROLE_META[role].label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-[13px] text-[var(--color-fg-muted)]">
                        {invitation.courseTitle ?? 'Equipo'}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-xs text-[var(--color-fg-muted)]">
                        {formatDate(invitation.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-xs text-[var(--color-fg-muted)]">
                        {invitation.acceptedAt ? formatDate(invitation.acceptedAt) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {invitationsPagination.total > invitationsPagination.limit ? (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-fg-muted)]">
            <span>
              Página {invitationsPagination.page} de {invitationsPagination.totalPages} ·{' '}
              {invitationsPagination.limit} por página
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={invitationsPagination.page <= 1}
                asChild={invitationsPagination.page > 1}
              >
                {invitationsPagination.page > 1 ? (
                  <Link href={invitationsPageHref(invitationsPagination.page - 1)}>Anterior</Link>
                ) : (
                  'Anterior'
                )}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={invitationsPagination.page >= invitationsPagination.totalPages}
                asChild={invitationsPagination.page < invitationsPagination.totalPages}
              >
                {invitationsPagination.page < invitationsPagination.totalPages ? (
                  <Link href={invitationsPageHref(invitationsPagination.page + 1)}>Siguiente</Link>
                ) : (
                  'Siguiente'
                )}
              </Button>
            </div>
          </footer>
        ) : null}
      </section>

      {viewingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-brand-700)]/30 font-mono text-sm font-semibold text-[var(--color-brand-300)]">
                  {initials(viewingMember.name, viewingMember.email)}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-lg font-semibold text-[var(--color-fg)]">
                    {viewingMember.name || viewingMember.email}
                  </h3>
                  <p className="mt-1 truncate text-sm text-[var(--color-fg-muted)]">
                    {viewingMember.email}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={ROLE_VARIANTS[normalizeRole(viewingMember.memberRole)]}>
                      {ROLE_META[normalizeRole(viewingMember.memberRole)].label}
                    </Badge>
                    {profileStatusMeta(viewingMember.profileStatus) ? (
                      <Badge variant={profileStatusMeta(viewingMember.profileStatus)!.variant}>
                        {profileStatusMeta(viewingMember.profileStatus)!.label}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setViewingMember(null)}
                className="rounded-lg p-1 text-[var(--color-fg-subtle)] hover:bg-white/5 hover:text-[var(--color-fg)]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <FieldView label="Nombre" value={viewingMember.firstName} />
              <FieldView label="Apellido" value={viewingMember.lastName} />
              <FieldView label="Documento" value={viewingMember.documentType} />
              <FieldView label="Número de documento" value={viewingMember.documentNumber} />
              <FieldView label="Fecha de nacimiento" value={viewingMember.birthDate} />
              <FieldView label="Teléfono" value={viewingMember.phone} />
              <FieldView label="País" value={viewingMember.country} />
              <FieldView label="Ciudad" value={viewingMember.city} />
              <FieldView label="Dirección" value={viewingMember.addressLine} />
              <FieldView label="Wallet" value={viewingMember.walletAddress} />
              <FieldView
                label="Perfil completado"
                value={
                  viewingMember.profileCompletedAt
                    ? formatDate(viewingMember.profileCompletedAt)
                    : null
                }
              />
              <FieldView
                label="Miembro desde"
                value={viewingMember.createdAt ? formatDate(viewingMember.createdAt) : null}
              />
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setViewingMember(null)}>Cerrar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo: invitar miembro */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--color-fg)]">Invitar miembro</h3>
                <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                  Le crearemos una cuenta (si aún no tiene) y le daremos acceso a esta institución.
                </p>
              </div>
              <button
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
                className="rounded-lg p-1 text-[var(--color-fg-subtle)] hover:bg-white/5 hover:text-[var(--color-fg)]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form action={handleInvite} className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="docente@tu-institucion.edu"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberRole">Rol</Label>
                <div className="grid gap-2">
                  {ASSIGNABLE_ROLES.map((r) => {
                    const meta = ROLE_META[r];
                    const Icon = meta.icon;
                    return (
                      <label
                        key={r}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-3 text-sm transition hover:border-[var(--color-brand-500)]/40 hover:bg-white/[0.04] has-[:checked]:border-[var(--color-brand-500)]/60 has-[:checked]:bg-[var(--color-brand-500)]/10"
                      >
                        <input
                          type="radio"
                          name="memberRole"
                          value={r}
                          defaultChecked={r === 'teacher'}
                          className="mt-1 accent-[var(--color-brand-500)]"
                        />
                        <span className="flex-1">
                          <span className="flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
                            <Icon className="h-4 w-4 text-[var(--color-brand-300)]" />
                            {meta.label}
                          </span>
                          <span className="mt-1 block text-xs text-[var(--color-fg-muted)]">
                            {meta.help}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false);
                    setError(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  loading={pending}
                  className="inline-flex items-center gap-1.5"
                >
                  <Mail className="h-4 w-4" />
                  Invitar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diálogo: invitación enviada */}
      {created && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-emerald-500/40 bg-[var(--color-bg)] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-fg)]">
                    Invitación enviada
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                    {created.email} recibirá un enlace para aceptar el acceso como{' '}
                    <strong className="text-[var(--color-fg)]">
                      {ROLE_META[normalizeRole(created.memberRole)].label}
                    </strong>
                    .
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreated(null)}
                className="rounded-lg p-1 text-[var(--color-fg-subtle)] hover:bg-white/5 hover:text-[var(--color-fg)]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 flex justify-end">
              <Button onClick={() => setCreated(null)}>Entendido</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
