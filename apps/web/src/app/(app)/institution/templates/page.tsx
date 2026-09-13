import { FileText, Layout, Sparkles } from 'lucide-react';
import { EmptyState, SectionHeading, StatCard } from '@/components/dashboard/stat-card';
import { meApi } from '@/lib/api/endpoints/me';
import { formatNumber, requireSession, safeFetch } from '@/lib/dashboard';
import { CreateTemplateDialog } from './create-template-dialog';
import { TemplateCreateOptions } from './template-create-options';
import { TemplatesList } from './templates-list';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const { token } = await requireSession();
  const list = await safeFetch(() => meApi.templates(token));
  const templates = list?.data ?? [];

  const totalUsage = templates.reduce((acc, t) => acc + t.usage, 0);
  const mostUsed =
    totalUsage > 0
      ? templates.reduce<(typeof templates)[number] | null>(
          (acc, t) => (acc && acc.usage >= t.usage ? acc : t),
          null,
        )
      : null;

  return (
    <div className="space-y-8">
      <SectionHeading
        title="Plantillas de certificado"
        description="Diseños reutilizables que se aplican al PDF on-chain. Sube un PDF propio o crea uno desde el editor interno sin tocar smart contracts."
        actions={<CreateTemplateDialog />}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Plantillas" value={formatNumber(templates.length)} icon={Layout} />
        <StatCard
          label="Certificados generados"
          value={formatNumber(totalUsage)}
          icon={FileText}
          hint="Suma de todas las plantillas"
        />
        <StatCard
          label="Más usada"
          value={mostUsed?.name ?? '—'}
          icon={Sparkles}
          hint={mostUsed ? `${formatNumber(mostUsed.usage)} certificados` : 'Sin emisiones todavía'}
        />
      </div>

      <TemplateCreateOptions />

      {templates.length === 0 ? (
        <EmptyState
          icon={Layout}
          title="Sin plantillas aún"
          description="Sube un PDF o abre el editor interno para crear tu primera plantilla."
          action={<CreateTemplateDialog cta="Crear primera plantilla" />}
        />
      ) : (
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
            Mis plantillas
          </h2>
          <TemplatesList templates={templates} />
        </section>
      )}
    </div>
  );
}
