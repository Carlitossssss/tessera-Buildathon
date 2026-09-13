import { Info } from 'lucide-react';

export function PreviewBanner({
  title = 'Datos ficticios — vista previa',
  description = 'Esta sección utiliza datos demo. La integración con la API se habilitará en una próxima versión del panel.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
      <div className="text-[var(--color-fg-muted)]">
        <strong className="text-[var(--color-fg)]">{title}.</strong> {description}
      </div>
    </div>
  );
}
