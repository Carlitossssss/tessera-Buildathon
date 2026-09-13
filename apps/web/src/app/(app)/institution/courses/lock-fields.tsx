'use client';

import { ExternalLink, Wallet } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Configuración del Lock que abre un curso.
 *
 * Vive aparte porque aparece en dos sitios --crear y editar-- y son el mismo
 * formulario: si se duplicara, una corrección en uno se olvidaría en el otro
 * y quedarían dos comportamientos distintos para el mismo dato.
 *
 * Sólo se muestra cuando la visibilidad es 'token_gated'. Los valores viajan
 * por FormData; la validación real la hacen la API y un CHECK en la base,
 * porque un curso con membresía sin Lock sería imposible de matricular.
 */

/**
 * Redes donde se puede anclar un Lock. Sólo testnets, y sólo donde Unlock
 * está desplegado: debe coincidir con UNLOCK_NETWORKS del backend, que
 * rechaza cualquier otra.
 */
export const LOCK_CHAINS = [
  { id: 11155111, label: 'Ethereum Sepolia' },
  { id: 84532, label: 'Base Sepolia' },
  { id: 43113, label: 'Avalanche Fuji' },
] as const;

export type CourseAccessMode = 'perpetual' | 'subscription';

export interface LockFieldsProps {
  lockAddress: string;
  onLockAddressChange: (value: string) => void;
  lockChainId: number;
  onLockChainIdChange: (value: number) => void;
  previewModuleCount: number;
  onPreviewModuleCountChange: (value: number) => void;
  /** Cómo caduca el acceso una vez concedido. */
  accessMode: CourseAccessMode;
  onAccessModeChange: (value: CourseAccessMode) => void;
  /** Total de módulos del curso, si ya existen: acota la muestra a lo real. */
  totalModules?: number;
  idPrefix?: string;
}

/** Valida la dirección antes de enviar, para dar el error junto al campo. */
export function isValidLockAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function LockFields({
  lockAddress,
  onLockAddressChange,
  lockChainId,
  onLockChainIdChange,
  previewModuleCount,
  onPreviewModuleCountChange,
  accessMode,
  onAccessModeChange,
  totalModules,
  idPrefix = 'lock',
}: LockFieldsProps) {
  const dirty = lockAddress.trim().length > 0;
  const invalid = dirty && !isValidLockAddress(lockAddress);

  // Avisar cuando se prometen más módulos de muestra de los que existen: el
  // servidor lo acota, pero aquí se ve antes de guardar.
  const overPreview =
    typeof totalModules === 'number' && totalModules > 0 && previewModuleCount > totalModules;

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-brand-500)]/30 bg-[color-mix(in_oklab,var(--color-brand-500),transparent_94%)] p-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 shrink-0 text-[var(--color-brand-300)]" />
        <p className="text-sm font-medium text-[var(--color-fg)]">Membresía que abre el curso</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-address`}>Dirección del Lock</Label>
          <Input
            id={`${idPrefix}-address`}
            value={lockAddress}
            onChange={(e) => onLockAddressChange(e.target.value)}
            placeholder="0x…"
            className="font-mono text-[13px]"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={invalid || undefined}
          />
          {invalid ? (
            <p className="text-[11px] text-[var(--color-danger-500)]">
              Debe ser una dirección EVM: 0x seguido de 40 caracteres.
            </p>
          ) : (
            /* La dirección del Lock y la de la wallet se parecen —las dos
               empiezan por 0x y miden 42 caracteres— y confundirlas deja el
               curso imposible de matricular. Se dice aquí, junto al campo,
               porque es donde se pega. */
            <p className="text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
              Es la dirección del <strong className="text-[var(--color-fg-muted)]">contrato</strong>{' '}
              que creó Unlock, no la de tu wallet. Se comprueba contra la red al guardar.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-chain`}>Red del Lock</Label>
          <select
            id={`${idPrefix}-chain`}
            value={lockChainId}
            onChange={(e) => onLockChainIdChange(Number(e.target.value))}
            className="h-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-fg)] outline-none transition-colors focus:border-[var(--color-brand-500)]/60"
          >
            {LOCK_CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cómo caduca el acceso. Es la diferencia entre vender una vez y
          cobrar cada mes, y hasta ahora no se podía elegir: todo curso se
          comportaba como pago único aunque su Lock fuera mensual. */}
      <div className="grid gap-2">
        <Label>Cómo caduca el acceso</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              {
                value: 'perpetual' as const,
                title: 'Pago único',
                hint: 'Quien entra conserva el curso aunque su membresía venza.',
              },
              {
                value: 'subscription' as const,
                title: 'Suscripción',
                hint: 'El acceso se cierra cuando la membresía caduca, hasta renovarla.',
              },
            ] satisfies { value: CourseAccessMode; title: string; hint: string }[]
          ).map((option) => {
            const active = accessMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onAccessModeChange(option.value)}
                aria-pressed={active}
                className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                  active
                    ? 'border-[var(--color-brand-500)]/60 bg-[var(--color-brand-500)]/10'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-brand-500)]/35'
                }`}
              >
                <span
                  className={`block text-[13px] font-medium ${
                    active ? 'text-[var(--color-brand-200)]' : 'text-[var(--color-fg)]'
                  }`}
                >
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
        {accessMode === 'subscription' ? (
          <p className="text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
            La llave se vuelve a comprobar on-chain cada vez que el estudiante abre el material. La
            duración la fija tu Lock en Unlock, no Tessera.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-preview`}>Módulos de muestra</Label>
        <Input
          id={`${idPrefix}-preview`}
          type="number"
          min={0}
          max={50}
          value={previewModuleCount}
          onChange={(e) => onPreviewModuleCountChange(Number(e.target.value))}
          className="sm:max-w-[160px]"
        />
        <p className="text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
          Los primeros módulos quedan abiertos para que cualquiera pruebe el curso antes de comprar
          la membresía. El resto no sale del servidor sin una llave válida.
          {typeof totalModules === 'number' && totalModules > 0
            ? ` Este curso tiene ${totalModules} módulo${totalModules === 1 ? '' : 's'}.`
            : ''}
        </p>
        {overPreview ? (
          <p className="text-[11px] text-[var(--color-warning-500)]">
            Sólo hay {totalModules} módulo{totalModules === 1 ? '' : 's'}: se abrirán todos y no
            quedará nada detrás de la membresía.
          </p>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
        ¿Todavía no tenés un Lock? Creá uno en{' '}
        <a
          href="https://app.unlock-protocol.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-[var(--color-brand-300)] underline underline-offset-2"
        >
          app.unlock-protocol.com
          <ExternalLink className="h-3 w-3" />
        </a>{' '}
        y pegá su dirección acá.
      </p>
    </div>
  );
}
