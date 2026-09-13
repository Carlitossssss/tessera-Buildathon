'use client';

import { Marquee } from '@/components/fx/marquee';
import { Quote } from 'lucide-react';
import { useT } from '@tessera/i18n';

const testimonials = [
  {
    quote:
      'Pasamos de imprimir PDFs a emitir 800 credenciales por bootcamp en una mañana. Nuestros alumnos las comparten en LinkedIn el mismo día.',
    author: 'María Rojas',
    role: 'Directora Académica · Devstart',
  },
  {
    quote:
      'La verificación pública nos quitó 6 horas semanales de soporte. Las empresas confían sin pedirnos confirmación manual.',
    author: 'Carlos Méndez',
    role: 'COO · Atlas University',
  },
  {
    quote:
      'Conectamos Tessera con nuestro LMS en menos de un sprint. Webhooks firmados, idempotencia, todo lo que esperamos de una API robusta.',
    author: 'Ana Iturri',
    role: 'CTO · Edify Online',
  },
  {
    quote:
      'Nos enamoramos del flujo soulbound. Los certificados son nuestros otra vez, no fotocopias en una carpeta.',
    author: 'Diego Soto',
    role: 'Rector · Instituto Norte',
  },
  {
    quote:
      'Compliance verificó GDPR en una semana. La PII vive off-chain y el hash on-chain hizo todo más fácil.',
    author: 'Lucía Fernández',
    role: 'Legal & Risk · Acrópolis',
  },
  {
    quote:
      'El dashboard es elegante. Los profesores entienden la emisión sin tutorial. Eso vale oro.',
    author: 'Tomás Vidal',
    role: 'Head of Product · Coderhouse',
  },
];

export function Testimonials() {
  const t = useT();
  const half = Math.ceil(testimonials.length / 2);
  return (
    <section className="relative isolate border-b border-[var(--color-border)] py-28">
      <div className="container-page">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-brand-200)]">
            {t.marketing.testimonials.eyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--color-fg)] sm:text-5xl">
            {t.marketing.testimonials.title}
          </h2>
        </header>
      </div>

      <div className="mt-16 space-y-6">
        <Marquee duration={48} pauseOnHover>
          {testimonials.slice(0, half).map((t) => (
            <TestimonialCard key={t.author} {...t} />
          ))}
        </Marquee>
        <Marquee duration={56} pauseOnHover reverse>
          {testimonials.slice(half).map((t) => (
            <TestimonialCard key={t.author} {...t} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}

function TestimonialCard({ quote, author, role }: { quote: string; author: string; role: string }) {
  const initials = author
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <figure className="flex w-[360px] shrink-0 flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-white/[0.025] p-6 shadow-[var(--shadow-card)] backdrop-blur">
      <Quote className="h-5 w-5 text-[var(--color-brand-200)]" />
      <blockquote className="text-sm leading-relaxed text-[var(--color-fg)]">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[var(--color-brand-500)] to-[var(--color-accent-500)] text-sm font-semibold text-[#080d1a]">
          {initials}
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--color-fg)]">{author}</p>
          <p className="text-xs text-[var(--color-fg-subtle)]">{role}</p>
        </div>
      </figcaption>
    </figure>
  );
}
