import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from '@/components/dashboard/stat-card';
import { PreviewBanner } from '@/components/dashboard/preview-banner';
import { meApi, type InstitutionCertificate } from '@/lib/api/endpoints/me';
import { relativeTime, requireSession, safeFetch } from '@/lib/dashboard';
import { pendingApprovalGate } from '../../approval-gate';

export const dynamic = 'force-dynamic';

type RequestStatus = 'pending' | 'approved' | 'rejected';

function requestStatus(cert: InstitutionCertificate): RequestStatus {
  if (cert.status === 'issued') return 'approved';
  if (cert.status === 'failed' || cert.status === 'revoked') return 'rejected';
  return 'pending';
}

type SBVariant = 'warning' | 'success' | 'danger';
const STATUS_BADGE: Record<string, { label: string; variant: SBVariant }> = {
  pending: { label: 'Pendiente', variant: 'warning' },
  approved: { label: 'Aprobada', variant: 'success' },
  rejected: { label: 'Rechazada', variant: 'danger' },
};

export default async function CertificateRequestsPage() {
  const { token } = await requireSession();
  const approvalGate = await pendingApprovalGate(token);
  if (approvalGate) return approvalGate;
  const res = await safeFetch(() => meApi.certificates(token, { page: 1, limit: 100 }));
  const requests =
    res?.data.map((cert) => ({
      id: cert.id,
      student: cert.studentName,
      course: cert.achievementName,
      teacher: '—',
      grade: cert.grade ?? 0,
      requestedAt: relativeTime(cert.createdAt),
      status: requestStatus(cert),
    })) ?? [];
  const pending = requests.filter((r) => r.status === 'pending');

  return (
    <div className="space-y-6">
      <PreviewBanner />
      <SectionHeading
        title="Solicitudes de emisión"
        description="Docentes solicitan emisión → admin aprueba → Tessera emite el SBT on-chain"
        actions={
          pending.length > 0 && (
            <Button size="sm" variant="secondary" disabled>
              <Check className="h-4 w-4" />
              Aprobar pendientes ({pending.length})
            </Button>
          )
        }
      />

      {/* Flujo explicativo */}
      <div className="grid gap-3 sm:grid-cols-3 text-center text-sm">
        {['Docente solicita', 'Admin aprueba', 'SBT emitido on-chain'].map((step, i) => (
          <div
            key={step}
            className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-3"
          >
            <span className="mb-1 block text-xs font-semibold text-[var(--color-fg-subtle)]">
              Paso {i + 1}
            </span>
            <span className="text-[var(--color-fg)]">{step}</span>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.02]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-[var(--color-fg-subtle)]">
            <tr>
              <th className="px-4 py-3 font-medium">Estudiante</th>
              <th className="px-4 py-3 font-medium hidden sm:table-cell">Curso</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Docente</th>
              <th className="px-4 py-3 font-medium text-right hidden lg:table-cell">Nota</th>
              <th className="px-4 py-3 font-medium hidden xl:table-cell">Solicitada</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-fg-muted)]">
            {requests.map((r) => {
              const sb = (STATUS_BADGE[r.status] ?? STATUS_BADGE.pending) as {
                label: string;
                variant: SBVariant;
              };
              return (
                <tr key={r.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[var(--color-fg)] font-medium">{r.student}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{r.course}</td>
                  <td className="px-4 py-3 hidden md:table-cell">{r.teacher}</td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell">
                    <span
                      className={
                        r.grade >= 70 ? 'text-emerald-400' : 'text-[var(--color-danger-500)]'
                      }
                    >
                      {r.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">{r.requestedAt}</td>
                  <td className="px-4 py-3">
                    <Badge variant={sb.variant}>{sb.label}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          disabled
                          title="La emisión ya está en cola"
                          className="h-7 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border-0"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          disabled
                          title="La emisión ya está en cola"
                          className="h-7 bg-[var(--color-danger-500)]/10 text-[var(--color-danger-500)] hover:bg-[var(--color-danger-500)]/20 border-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
