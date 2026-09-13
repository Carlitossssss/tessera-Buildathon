'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Award,
  Building2,
  GraduationCap,
  KeyRound,
  ShieldCheck,
  Sparkles as SparklesIcon,
} from 'lucide-react';
import { useT, type Dictionary } from '@tessera/i18n';
import { CertificateMock } from '@/components/marketing/certificate-mock';

type Role = 'institution' | 'student' | 'teacher';

/**
 * Contenido del panel lateral, en el idioma activo.
 *
 * Antes era una constante con los textos escritos dentro. Ahora se arma desde
 * el diccionario: los iconos y la estructura no dependen del idioma, así que
 * siguen aquí, y sólo el texto viaja.
 *
 * Las citas de los testimonios se quedan sin traducir a propósito: son
 * palabras que alguien dijo, y traducir una cita cambia lo que esa persona
 * dijo.
 */
function copyFor(role: Role, t: Dictionary) {
  const shared = {
    institution: {
      title: t.auth.aside.institution.title,
      description: t.auth.aside.institution.description,
      bullets: [
        { icon: ShieldCheck, label: t.auth.aside.institution.bullets.sla },
        { icon: KeyRound, label: t.auth.aside.institution.bullets.roles },
        { icon: Award, label: t.auth.aside.institution.bullets.wallets },
      ],
      quote: {
        text: '“Pasamos de PDFs a SBTs verificables en una semana. Nuestra tasa de share en LinkedIn se multiplicó por 4.”',
        author: 'Andrea Méndez',
        role: 'Directora académica · Bootcamp Devstart',
      },
      mockProps: undefined as Partial<React.ComponentProps<typeof CertificateMock>> | undefined,
    },
    student: {
      title: t.auth.aside.student.title,
      description: t.auth.aside.student.description,
      bullets: [
        { icon: ShieldCheck, label: t.auth.aside.student.bullets.onchain },
        { icon: SparklesIcon, label: t.auth.aside.student.bullets.linkedin },
        { icon: GraduationCap, label: t.auth.aside.student.bullets.yours },
      ],
      quote: {
        text: '“Lo más rápido para mostrarle a un reclutador que algo es real. Cero PDFs, cero excusas.”',
        author: 'Sofía Pérez',
        role: 'Egresada · Bootcamp Devstart',
      },
      mockProps: {
        recipient: t.auth.aside.student.mockRecipient,
        course: t.auth.aside.student.mockCourse,
      } as Partial<React.ComponentProps<typeof CertificateMock>> | undefined,
    },
    teacher: {
      title: t.auth.aside.teacher.title,
      description: t.auth.aside.teacher.description,
      bullets: [
        { icon: Building2, label: t.auth.aside.teacher.bullets.linked },
        { icon: ShieldCheck, label: t.auth.aside.teacher.bullets.doubleSign },
        { icon: Award, label: t.auth.aside.teacher.bullets.cohort },
      ],
      quote: {
        text: '“El docente solicita, la institución aprueba. Sin pasar por mil correos.”',
        author: 'Política de emisión',
        role: 'Tessera · Workspace institucional',
      },
      mockProps: undefined as Partial<React.ComponentProps<typeof CertificateMock>> | undefined,
    },
  };
  return shared[role];
}

export function AuthAside() {
  const t = useT();
  const params = useSearchParams();
  const roleParam = params.get('role');
  const role: Role = useMemo(() => {
    if (roleParam === 'student' || roleParam === 'teacher') return roleParam;
    return 'institution';
  }, [roleParam]);

  const copy = copyFor(role, t);

  return (
    <motion.div
      key={role}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex h-full flex-col gap-5 overflow-y-auto px-7 pt-8 pb-7 xl:px-10 xl:pt-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="space-y-3.5">
        <h2
          className="max-w-[18ch] text-balance font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--color-fg)]"
          style={{ fontSize: 'clamp(1.55rem, 1.4vw + 0.85rem, 2.25rem)' }}
        >
          {copy.title}
        </h2>
        <p
          className="max-w-[44ch] leading-[1.55] text-[var(--color-fg-muted)]"
          style={{ fontSize: 'clamp(0.82rem, 0.25vw + 0.75rem, 0.9rem)' }}
        >
          {copy.description}
        </p>

        <ul className="flex flex-wrap gap-1.5 pt-1">
          {copy.bullets.map((b, i) => (
            <motion.li
              key={b.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.06, ease: [0.25, 1, 0.5, 1] }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-white/[0.03] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)] backdrop-blur"
            >
              <b.icon className="h-3 w-3 text-[var(--color-accent-400)]" />
              {b.label}
            </motion.li>
          ))}
        </ul>
      </div>

      <motion.div
        key={`mock-${role}`}
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto w-full max-w-[380px] flex-1 self-stretch"
      >
        <div
          className="absolute inset-x-6 -top-10 h-32 rounded-[80%] bg-[radial-gradient(ellipse_at_center,rgba(122,242,199,0.16),transparent_70%)] blur-2xl"
          aria-hidden
        />
        <div className="relative flex h-full items-center">
          <CertificateMock {...(copy.mockProps ?? {})} />
        </div>
      </motion.div>

      <figure className="rounded-xl border border-[var(--color-border)] bg-[rgba(11,15,36,0.78)] p-3.5 backdrop-blur">
        <blockquote className="text-[12.5px] leading-[1.55] text-[var(--color-fg)]">
          {copy.quote.text}
        </blockquote>
        <figcaption className="mt-2 text-[10.5px] text-[var(--color-fg-subtle)]">
          <span className="font-semibold text-[var(--color-fg)]">{copy.quote.author}</span> ·{' '}
          {copy.quote.role}
        </figcaption>
      </figure>
    </motion.div>
  );
}
