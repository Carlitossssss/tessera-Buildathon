'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ExternalLink,
  KeyRound,
  Lock,
  ShieldCheck,
  Terminal,
  Webhook,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { cn } from '@/lib/utils';

interface Props {
  baseUrl: string;
  canOpenOpenApi: boolean;
}

const SCOPES: Array<{ id: string; what: string }> = [
  { id: 'certificates:read', what: 'Listar y consultar certificados emitidos.' },
  { id: 'certificates:write', what: 'Emitir y revocar certificados.' },
  { id: 'badges:read', what: 'Consultar badges.' },
  { id: 'badges:write', what: 'Emitir badges.' },
  { id: 'courses:read', what: 'Leer cursos y matrículas.' },
  { id: 'courses:write', what: 'Crear y actualizar cursos.' },
  { id: 'wallet:read', what: 'Consultar la identidad emisora on-chain.' },
];

const EVENTS: Array<{ id: string; when: string }> = [
  { id: 'certificate.issued', when: 'El certificado quedó confirmado en la blockchain.' },
  { id: 'certificate.failed', when: 'La emisión falló; el crédito se devuelve automáticamente.' },
  { id: 'certificate.revoked', when: 'Un certificado fue revocado.' },
  { id: 'badge.issued', when: 'Se emitió un badge.' },
  { id: 'credits.low_balance', when: 'Quedan pocos créditos disponibles.' },
  { id: 'payment.received', when: 'Se acreditó un pago.' },
];

const REVOKE_REASONS = [
  { code: 'fraud_detected', desc: 'Se comprobó que el logro era fraudulento (plagio, suplantación).' },
  { code: 'incorrect_data', desc: 'Se emitió con datos equivocados. Revocás y emitís uno corregido.' },
  { code: 'duplicated', desc: 'Se emitió dos veces el mismo certificado al mismo alumno.' },
  { code: 'institution_request', desc: 'Decisión académica de la institución.' },
  { code: 'student_request', desc: 'El estudiante pidió que se retire.' },
  { code: 'other', desc: 'Cualquier otro motivo. Explicalo en reasonText.' },
];

const REVOKE_STEPS = [
  {
    t: '1. En tu base de Tessera',
    d: 'El certificado pasa a estado «revoked» al instante, con el motivo y la fecha. La verificación pública ya lo muestra como no válido.',
  },
  {
    t: '2. En la blockchain',
    d: 'Un job quema el token (burn). A partir de ahí ownerOf revierte: el NFT deja de existir en la wallet del estudiante.',
  },
  {
    t: '3. Lo que NO desaparece',
    d: 'La transacción de emisión original sigue en Polygon para siempre, junto a la de revocación. Cualquiera puede auditar que se emitió y que después se anuló.',
  },
];

const CORRECTION_FLOW =
  '# 1. Revocás el que tiene el error\n' +
  'POST /v1/certificates/<id>/revoke\n' +
  '     { "reason": "incorrect_data", "reasonText": "Nota incorrecta" }\n\n' +
  '# 2. Emitís uno nuevo con los datos correctos\n' +
  'POST /v1/certificates\n' +
  '     { "student": {...}, "achievement": { ...datos corregidos... } }';

function revokeExample(baseUrl: string): string {
  return (
    `curl -X POST ${baseUrl}/v1/certificates/<id>/revoke \\\n` +
    '  -H "x-api-key: $TESSERA_API_KEY" \\\n' +
    '  -H "Content-Type: application/json" \\\n' +
    "  -d '{" + '\n' +
    '    "reason": "incorrect_data",\n' +
    '    "reasonText": "La nota final se cargó mal: figuraba 95 y corresponde 85.",\n' +
    '    "publicReason": true\n' +
    "  }'"
  );
}

type TabId = 'auth' | 'endpoints' | 'lifecycle' | 'webhooks' | 'errors';

const TABS: Array<{ id: TabId; label: string; icon: typeof KeyRound }> = [
  { id: 'auth', label: 'Autenticación', icon: KeyRound },
  { id: 'endpoints', label: 'Endpoints', icon: Terminal },
  { id: 'lifecycle', label: 'Inmutabilidad y revocación', icon: Lock },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
  { id: 'errors', label: 'Errores y límites', icon: AlertTriangle },
];

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="group relative mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[#070b1c]">
      {label ? (
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
            {label}
          </span>
          <CopyButton value={children} label="Copiar" variant="ghost" />
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Section({
  title,
  children,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h3 className="text-base font-semibold tracking-[-0.01em] text-[var(--color-fg)]">{title}</h3>
      {hint ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-fg-muted)]">{hint}</p>
      ) : null}
      {children}
    </section>
  );
}

export function DevelopersDocs({ baseUrl, canOpenOpenApi }: Props) {
  const [tab, setTab] = useState<TabId>('auth');

  return (
    <div className="pb-16">
      <header className="border-b border-[var(--color-border)] pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-fg-muted)]">
              <Lock className="h-3 w-3 text-[var(--color-accent-400)]" />
              Documentación privada
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-[var(--color-fg)] sm:text-3xl">
              API de Tessera
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
              Integrá tu LMS o backoffice para emitir credenciales verificables y recibir eventos en
              tiempo real. Esta referencia solo es visible con sesión iniciada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/institution/api-keys">
                <KeyRound className="h-4 w-4" /> Mis API keys
              </Link>
            </Button>
            {canOpenOpenApi ? (
              <Button asChild variant="outline">
                <a href={`${baseUrl}/v1/docs`} target="_blank" rel="noreferrer">
                  OpenAPI <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-fg-subtle)]">
            URL base
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <code className="truncate font-mono text-sm text-[var(--color-fg)]">{baseUrl}</code>
            <CopyButton value={baseUrl} label="Copiar" variant="ghost" />
          </div>
        </div>
      </header>

      <nav className="sticky top-0 z-10 -mx-1 mt-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-1 pb-px backdrop-blur">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-[var(--color-brand-400)] text-[var(--color-fg)]'
                  : 'border-transparent text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-8 max-w-3xl">
        {tab === 'auth' ? (
          <>
            <Section
              title="Autenticá con tu API key"
              hint="Creá la clave desde Mis API keys. Se muestra una sola vez: guardala en tu gestor de secretos, nunca en el repositorio ni en el frontend."
            >
              <Code label="cURL">{`curl ${baseUrl}/v1/certificates \\
  -H "x-api-key: tss_xxxxxxxx_tu_clave_secreta"`}</Code>
            </Section>

            <Section
              title="Scopes"
              hint="Cada clave lleva solo los permisos que le asignás. Si falta uno, la respuesta es 403 indicando cuál."
            >
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
                {SCOPES.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3',
                      i > 0 && 'border-t border-[var(--color-border)]',
                    )}
                  >
                    <code className="font-mono text-[13px] text-[var(--color-accent-400)]">
                      {s.id}
                    </code>
                    <span className="text-sm text-[var(--color-fg-muted)]">{s.what}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Revocación"
              hint="Revocar una clave la invalida de inmediato. Cualquier request posterior devuelve 401."
            >
              <Code label="cURL">{`curl -X DELETE ${baseUrl}/v1/api-keys/<id> \\
  -H "Authorization: Bearer <jwt-del-dashboard>"`}</Code>
            </Section>
          </>
        ) : null}

        {tab === 'endpoints' ? (
          <>
            <Section
              title="Emitir un certificado"
              hint="La emisión es asíncrona: responde al instante con un id y el certificado se confirma en la blockchain en segundos. Escuchá certificate.issued para saber cuándo terminó."
            >
              <Code label="POST /v1/certificates">{`curl -X POST ${baseUrl}/v1/certificates \\
  -H "x-api-key: $TESSERA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "student": {
      "email": "ana.garcia@uni.pe",
      "name": "Ana García"
    },
    "achievement": {
      "name": "Solidity Avanzado",
      "description": "Programa de 120 horas.",
      "grade": 95,
      "completedAt": "2026-09-01T00:00:00.000Z"
    },
    "idempotencyKey": "matricula-4821"
  }'`}</Code>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                <code className="font-mono text-[var(--color-fg)]">idempotencyKey</code> es
                opcional pero muy recomendable: si tu sistema reintenta, evita emitir el mismo
                certificado dos veces y gastar un crédito de más.
              </p>
            </Section>

            <Section title="Consultar certificados" hint="Requiere el scope certificates:read.">
              <Code label="GET /v1/certificates">{`curl ${baseUrl}/v1/certificates \\
  -H "x-api-key: $TESSERA_API_KEY"`}</Code>
            </Section>

            <Section
              title="Verificación pública"
              hint="No necesita autenticación: es el endpoint que usa un empleador para comprobar una credencial."
            >
              <Code label="GET /v1/verify/{tokenId}">{`curl ${baseUrl}/v1/verify/3`}</Code>
            </Section>
          </>
        ) : null}

        {tab === 'lifecycle' ? (
          <>
            <Section
              title="Un certificado emitido no se puede modificar. Nunca."
              hint="Esto no es una política nuestra: lo impone el contrato en la blockchain. Ni Tessera ni tu institución pueden cambiar el nombre, la nota ni la fecha de un certificado ya emitido."
            >
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    t: 'No se edita',
                    d: 'No existe ninguna función para cambiar los datos. Si te equivocaste, se revoca y se emite uno nuevo.',
                  },
                  {
                    t: 'No se transfiere',
                    d: 'ERC-5192 soulbound: queda ligado al estudiante. transferFrom y approve revierten siempre.',
                  },
                  {
                    t: 'No se borra la historia',
                    d: 'La emisión original queda registrada para siempre en Polygon, aunque después revoques.',
                  },
                ].map((c) => (
                  <div
                    key={c.t}
                    className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Lock className="h-3.5 w-3.5 text-[var(--color-accent-400)]" />
                      <p className="text-sm font-semibold text-[var(--color-fg)]">{c.t}</p>
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                      {c.d}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Entonces, ¿por qué existe «revocar»?"
              hint="Porque en el mundo real una institución a veces necesita retirar la validez de un título: se detectó un plagio, el alumno pidió darse de baja, o se emitió por error. Un diploma de papel se anula igual; la diferencia es que aquí queda constancia pública de que se anuló."
            >
              <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)]">
                {REVOKE_REASONS.map((r, i) => (
                  <div
                    key={r.code}
                    className={cn(
                      'flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3',
                      i > 0 && 'border-t border-[var(--color-border)]',
                    )}
                  >
                    <code className="font-mono text-[13px] text-[var(--color-accent-400)]">
                      {r.code}
                    </code>
                    <span className="flex-1 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                      {r.desc}
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Qué pasa exactamente al revocar"
              hint="La revocación ocurre en dos capas, y las dos importan."
            >
              <ol className="mt-4 space-y-3">
                {REVOKE_STEPS.map((s) => (
                  <li
                    key={s.t}
                    className="rounded-xl border border-[var(--color-border)] bg-white/[0.02] p-4"
                  >
                    <p className="text-sm font-semibold text-[var(--color-fg)]">{s.t}</p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                      {s.d}
                    </p>
                  </li>
                ))}
              </ol>
            </Section>

            <Section
              title="Cómo revocar"
              hint="Requiere el scope certificates:write. Solo funciona sobre certificados en estado «issued»; si ya estaba revocado responde 409."
            >
              <Code label="POST /v1/certificates/{id}/revoke">{revokeExample(baseUrl)}</Code>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                <code className="font-mono text-[var(--color-fg)]">publicReason: true</code> muestra
                el motivo en la página de verificación. Ponelo en{' '}
                <code className="font-mono text-[var(--color-fg)]">false</code> si el texto contiene
                datos sensibles del estudiante.
              </p>
            </Section>

            <Section
              title="El caso más común: me equivoqué en un dato"
              hint="No busques un endpoint para corregir, no existe. El flujo correcto son dos pasos."
            >
              <Code label="Corregir un certificado">{CORRECTION_FLOW}</Code>
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--color-warning-500)]/25 bg-[var(--color-warning-500)]/[0.05] p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning-500)]" />
                <p className="text-[13px] leading-relaxed text-[var(--color-fg-muted)]">
                  El certificado nuevo{' '}
                  <strong className="text-[var(--color-fg)]">consume otro crédito</strong>: es una
                  emisión completa. Por eso conviene validar los datos en tu sistema antes de
                  emitir, y usar <code className="font-mono">idempotencyKey</code> para que un
                  reintento no genere duplicados.
                </p>
              </div>
            </Section>

            <Section
              title="Quién puede revocar"
              hint="La función revoke del contrato es onlyOwner: solo la ejecuta Tessera como operador de la plataforma, a petición de la institución dueña del certificado."
            >
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                Tu API key con{' '}
                <code className="font-mono text-[var(--color-fg)]">certificates:write</code>{' '}
                autoriza la solicitud, y la API comprueba que el certificado pertenezca a tu
                institución antes de proceder. Ninguna institución puede revocar certificados de
                otra.
              </p>
            </Section>
          </>
        ) : null}

        {tab === 'webhooks' ? (
          <>
            <Section
              title="Registrar un endpoint"
              hint="La URL debe ser https y apuntar a un host público. El secret se devuelve una sola vez."
            >
              <Code label="POST /v1/webhooks">{`curl -X POST ${baseUrl}/v1/webhooks \\
  -H "Authorization: Bearer <jwt-del-dashboard>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://tu-dominio.com/hooks/tessera",
    "events": ["certificate.issued", "certificate.failed"]
  }'`}</Code>
            </Section>

            <Section title="Eventos disponibles">
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
                {EVENTS.map((e, i) => (
                  <div
                    key={e.id}
                    className={cn(
                      'flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3',
                      i > 0 && 'border-t border-[var(--color-border)]',
                    )}
                  >
                    <code className="font-mono text-[13px] text-[var(--color-accent-400)]">
                      {e.id}
                    </code>
                    <span className="text-sm text-[var(--color-fg-muted)]">{e.when}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              title="Verificá la firma"
              hint="Cada entrega viaja firmada con HMAC-SHA256 sobre «timestamp.body». Validala siempre antes de confiar en el contenido, y rechazá timestamps viejos para frenar reenvíos."
            >
              <Code label="Node.js">{`import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyTessera(req, secret) {
  const header = req.headers['x-tessera-signature'];   // t=...,v1=...
  const parts = Object.fromEntries(
    String(header).split(',').map((p) => p.split('=')),
  );

  // El body debe ser el texto crudo, sin volver a serializar el JSON.
  const expected = createHmac('sha256', secret)
    .update(\`\${parts.t}.\${req.rawBody}\`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  // Rechazá entregas de más de 5 minutos.
  return Math.abs(Date.now() / 1000 - Number(parts.t)) < 300;
}`}</Code>
            </Section>

            <Section
              title="Reintentos"
              hint="Si tu endpoint no responde 2xx, reintentamos con backoff exponencial. Respondé 200 rápido y procesá en segundo plano; usá X-Tessera-Event-Id para descartar duplicados."
            >
              <Code label="Cabeceras de cada entrega">{`X-Tessera-Event-Id: evt_...
X-Tessera-Event-Type: certificate.issued
X-Tessera-Timestamp: 1788000000
X-Tessera-Signature: t=1788000000,v1=<hmac-sha256>
X-Tessera-Delivery-Attempt: 1`}</Code>
            </Section>
          </>
        ) : null}

        {tab === 'errors' ? (
          <>
            <Section title="Códigos de error">
              <div className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)]">
                {[
                  ['401', 'Clave ausente, inválida, expirada o revocada.'],
                  ['403', 'Falta un scope, o la institución no está aprobada.'],
                  ['404', 'El recurso no existe o no pertenece a tu institución.'],
                  ['409', 'Conflicto: el recurso ya existe.'],
                  ['422', 'Payload inválido; el detalle indica el campo.'],
                  ['429', 'Superaste el límite de tu plan.'],
                ].map(([code, desc], i) => (
                  <div
                    key={code}
                    className={cn(
                      'flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3',
                      i > 0 && 'border-t border-[var(--color-border)]',
                    )}
                  >
                    <code className="font-mono text-[13px] text-[var(--color-brand-300)]">
                      {code}
                    </code>
                    <span className="text-sm text-[var(--color-fg-muted)]">{desc}</span>
                  </div>
                ))}
              </div>
              <Code label="Formato de error">{`{
  "error": {
    "code": "FORBIDDEN",
    "message": "Falta el scope requerido: certificates:write",
    "requestId": "A0p065ibgPGlZpvQ"
  }
}`}</Code>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-fg-muted)]">
                Incluí el <code className="font-mono text-[var(--color-fg)]">requestId</code> cuando
                nos escribas: con él localizamos la request exacta.
              </p>
            </Section>

            <Section
              title="Buenas prácticas"
              hint="Lo que evita el 90% de los problemas de integración."
            >
              <ul className="mt-3 space-y-2.5">
                {[
                  'Guardá la API key en variables de entorno, nunca en el código ni en el navegador.',
                  'Usá una clave distinta por sistema: revocar una no afecta a las demás.',
                  'Asigná solo los scopes que ese sistema necesita.',
                  'Validá siempre la firma HMAC antes de procesar un webhook.',
                  'Tratá las entregas como idempotentes usando X-Tessera-Event-Id.',
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent-400)]" />
                    <span className="text-sm leading-relaxed text-[var(--color-fg-muted)]">
                      {tip}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}
