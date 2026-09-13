import Link from 'next/link';
import { Suspense } from 'react';
import { BrandMark } from '@/components/brand/brand-mark';
import { AuroraBackground } from '@/components/fx/aurora-background';
import { GridBackground } from '@/components/fx/grid-background';
import { Sparkles } from '@/components/fx/sparkles';
import { Spotlight } from '@/components/fx/spotlight';
import { AuthAside } from '@/components/auth/auth-aside';
import { AuthLayoutChrome, AuthLayoutFooter } from '@/components/auth/auth-layout-chrome';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh w-full lg:grid lg:grid-cols-[minmax(440px,520px)_1fr]">
      <section className="relative isolate flex min-h-svh flex-col border-b border-[var(--color-border)] px-5 sm:px-7 md:px-9 lg:border-b-0 lg:border-r">
        <AuroraBackground intensity="soft" className="-z-10" />
        <Sparkles density={10} className="-z-10" />

        <header className="flex shrink-0 items-center justify-between pt-5 sm:pt-6">
          <Link href="/" className="inline-flex w-fit" aria-label="Tessera home">
            <BrandMark />
          </Link>
          {/* El selector vive aqui porque esta es la primera pantalla que
              ve alguien que llega: elegir idioma no puede exigir tener cuenta.
              La marca de acceso seguro lo acompana en el mismo grupo. */}
          <AuthLayoutChrome />
        </header>

        <div className="flex flex-1 items-center py-8 sm:py-10">
          <div className="mx-auto w-full max-w-[460px]">{children}</div>
        </div>

        <AuthLayoutFooter year={new Date().getFullYear()} />
      </section>

      <aside className="relative isolate hidden overflow-hidden bg-[var(--color-bg-elevated)] lg:sticky lg:top-0 lg:block lg:h-svh">
        <GridBackground />
        <AuroraBackground intensity="medium" />
        <Spotlight color="rgba(122, 242, 199, 0.18)" />
        <Sparkles density={22} />
        <Suspense fallback={null}>
          <AuthAside />
        </Suspense>
      </aside>
    </div>
  );
}
