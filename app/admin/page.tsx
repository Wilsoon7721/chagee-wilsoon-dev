import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@wilsoon/auth-next/server';
import { authConfig } from '@/lib/auth-config';
import { createPrivilegedSupabaseClient } from '@/lib/supabase';
import type { AdminPendingContribution } from '@/lib/database.types';
import ReviewActions from '@/components/review-actions';

export const metadata: Metadata = {
  title: 'Admin Review Queue | CHAGEE Tool | Wilson Oon'
};

const FLAG_LABELS: Array<{ key: keyof Pick<AdminPendingContribution, 'flag_new_sku' | 'flag_new_codes' | 'flag_size_mismatch' | 'flag_missing_expected_milk' | 'flag_unexpected_milk'>; label: string; severity: 'critical' | 'warning' | 'info' }> = [
  { key: 'flag_size_mismatch', label: 'Size mismatch', severity: 'critical' },
  { key: 'flag_missing_expected_milk', label: 'Missing milk code', severity: 'critical' },
  { key: 'flag_unexpected_milk', label: 'Unexpected milk code', severity: 'critical' },
  { key: 'flag_new_codes', label: 'New A/C/m/mm code', severity: 'warning' },
  { key: 'flag_new_sku', label: 'New SKU', severity: 'info' }
];

const FLAG_STYLES = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
};

function FlagBadges({ row }: { row: AdminPendingContribution }) {
  const active = FLAG_LABELS.filter((f) => row[f.key]);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {active.map((f) => (
        <span key={f.key} className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${FLAG_STYLES[f.severity]}`}>
          {f.label}
        </span>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd className="font-mono text-zinc-900 break-all dark:text-zinc-100">{value ?? '-'}</dd>
    </div>
  );
}

function ContributionCard({ row }: { row: AdminPendingContribution }) {
  const submittedAt = new Date(row.submitted_at).toLocaleString('en-SG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-zinc-900 dark:text-zinc-50">{row.reported_drink_name}</p>
          <p className="text-xs text-zinc-400">{submittedAt}</p>
        </div>
        {row.has_flags && <FlagBadges row={row} />}
      </div>

      {/* Known SKU info banner */}
      {row.known_drink_name && (
        <div className="mb-3 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          Known as: <span className="font-semibold">{row.known_drink_name}</span>
          {row.known_category && ` · ${row.known_category}`}
        </div>
      )}

      {/* QR decode */}
      <dl className="mb-4 space-y-0.5">
        <DetailRow label="Raw payload" value={row.raw_payload} />
        <DetailRow label="SKU" value={`${row.sku_value} (${row.sku_type})`} />
        <DetailRow label="A / C / m" value={`${row.a_value ?? '-'} / ${row.c_value ?? '-'} / ${row.m_value ?? '-'}`} />
        <DetailRow label="mm (sweet)" value={row.mm_value ?? '- (omitted)'} />
      </dl>

      {/* User report */}
      <dl className="mb-4 space-y-0.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
        <DetailRow label="Size" value={row.reported_size ?? 'n/a'} />
        <DetailRow label="Sweetness" value={row.reported_sweetness ?? 'n/a'} />
        <DetailRow label="Ice" value={row.reported_ice} />
        <DetailRow label="Milk type" value={row.reported_milk_type ?? 'n/a'} />
      </dl>

      {/* Sticker image */}
      {row.image_url && (
        <div className="mb-4">
          <img src={row.image_url} alt="Cup sticker" className="max-h-48 rounded-lg object-contain" />
        </div>
      )}

      {/* Review actions */}
      <ReviewActions id={row.id} />
    </article>
  );
}

export default async function AdminPage() {
  try {
    await requireSession(authConfig, { roles: ['admin'] });
  } catch (err: any) {
    console.error('[admin] session verification failed:', err);
    const code = err.code ? err.code.toLowerCase() : 'auth_failed';
    redirect(`/admin/login?error=${code}`);
  }

  const supabase = createPrivilegedSupabaseClient();
  const { data: contributions, error } = await supabase.from('admin_pending_contributions').select('*');

  if (error) console.error('[admin] failed to load queue:', error.message);

  const rows = (contributions ?? []) as AdminPendingContribution[];
  const flagged = rows.filter((r) => r.has_flags);
  const unflagged = rows.filter((r) => !r.has_flags);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review Queue</h1>
          <p className="mt-1 text-sm text-zinc-500">{rows.length === 0 ? 'No pending contributions.' : `${rows.length} pending · ${flagged.length} flagged`}</p>
        </div>
        <Link href="/admin/analysis" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          Sweetness analysis →
        </Link>
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">Queue is empty. Nothing to review.</p>
        </div>
      )}

      {/* Flagged section */}
      {flagged.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-red-500">Flagged ({flagged.length})</h2>
          {flagged.map((row) => (
            <ContributionCard key={row.id} row={row} />
          ))}
        </section>
      )}

      {/* Clean section */}
      {unflagged.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">No flags ({unflagged.length})</h2>
          {unflagged.map((row) => (
            <ContributionCard key={row.id} row={row} />
          ))}
        </section>
      )}
    </div>
  );
}
