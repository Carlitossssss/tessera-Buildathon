'use client';

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Landmark, Loader2 } from 'lucide-react';
import {
  AccreditationPanel,
  type AccreditationData,
} from '@/components/verify/accreditation-panel';
import { accreditInstitutionAction } from '../../actions';

/**
 * Accreditation in the admin panel: the status and the action, together.
 *
 * The button only appears when it is needed. Leaving it visible for an
 * already-accredited institution invites clicking it for no reason and makes
 * one doubt whether the status shown is real --the operation is idempotent,
 * but the admin does not know that just by looking at the screen--.
 *
 * To decide this we listen to the result the panel already read from the
 * chain, instead of repeating the query: one read, one truth.
 */

interface Props {
  institutionId: string;
  slug: string;
  approved: boolean;
}

/** Audit network where accreditation happens. Matches the backend. */
const HSK_CHAIN_ID = 133;

export function AccreditationSection({ institutionId, slug, approved }: Props) {
  const reduced = useReducedMotion();
  const [data, setData] = useState<AccreditationData | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hsk = data?.chains.find((c) => c.chainId === HSK_CHAIN_ID);
  // While the status is unknown the action is not offered: showing the button
  // and hiding it half a second later is worse than waiting for the data.
  const needsAccreditation = approved && hsk !== undefined && hsk.accredited !== true;

  return (
    <div className="space-y-3">
      <AccreditationPanel slug={slug} onLoaded={setData} />

      <AnimatePresence initial={false}>
        {needsAccreditation ? (
          <motion.form
            action={accreditInstitutionAction}
            onSubmit={() => setSubmitting(true)}
            initial={{ opacity: 0, y: reduced ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -6 }}
            transition={{ duration: reduced ? 0.15 : 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[var(--color-border)] bg-white/[0.02] px-4 py-3"
          >
            <input type="hidden" name="institutionId" value={institutionId} />
            <input type="hidden" name="chainId" value={HSK_CHAIN_ID} />

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-accent-500)]/40 bg-[var(--color-accent-500)]/10 px-3 py-1.5 text-[13px] font-medium text-[var(--color-accent-400)] transition-colors hover:bg-[var(--color-accent-500)]/20 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Landmark className="h-3.5 w-3.5" />
              )}
              {submitting ? 'Accrediting…' : 'Accredit on HashKey Chain'}
            </button>

            <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-[var(--color-fg-subtle)]">
              Registers the institution in the audit registry. It is idempotent: repeating it does
              not spend extra gas.
            </span>
          </motion.form>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
