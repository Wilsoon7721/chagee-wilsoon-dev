import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireSession } from '@wilsoon/auth-next/server';
import { authConfig } from '@/lib/auth-config';
import { createPrivilegedSupabaseClient } from '@/lib/supabase';
import type { SweetnessAnalysisRow, SweetnessLevel, CupSize } from '@/lib/database.types';

export const metadata: Metadata = {
  title: 'Sweetness Analysis | CHAGEE Tool | Wilson Oon'
};

interface CellData {
  mmCodes: Record<string, number>; // mm code → count, e.g. { mm001: 3 }
  omittedCount: number; // rows where mm was omitted
  totalCount: number;
}

type PivotKey = string; // `${sku_code}::${cup_size ?? 'any'}`

interface PivotRow {
  skuCode: string;
  drinkName: string | null;
  drinkCategory: string | null;
  cupSize: CupSize | null;
  cells: Partial<Record<SweetnessLevel | 'omitted_sweetness', CellData>>;
  allMmCodes: string[];
}

const SWEETNESS_COLUMNS: Array<{ key: SweetnessLevel | 'omitted_sweetness'; label: string }> = [
  { key: 'normal', label: 'Normal Sweet' },
  { key: 'less', label: 'Less Sweet' },
  { key: 'slightly', label: 'Slightly Sweet' },
  { key: 'none', label: 'No Sugar' },
  { key: 'omitted_sweetness', label: 'Not reported' }
];

const CUP_SIZE_LABELS: Record<string, string> = {
  regular: 'Regular',
  large: 'Large'
};

function buildPivot(rows: SweetnessAnalysisRow[]): PivotRow[] {
  const map = new Map<PivotKey, PivotRow>();

  for (const row of rows) {
    const key: PivotKey = `${row.sku_code}::${row.cup_size ?? 'any'}`;

    if (!map.has(key))
      map.set(key, {
        skuCode: row.sku_code,
        drinkName: row.drink_name,
        drinkCategory: row.drink_category,
        cupSize: row.cup_size,
        cells: {},
        allMmCodes: []
      });

    const pivotRow = map.get(key)!;
    const colKey = (row.reported_sweetness ?? 'omitted_sweetness') as SweetnessLevel | 'omitted_sweetness';

    if (!pivotRow.cells[colKey]) pivotRow.cells[colKey] = { mmCodes: {}, omittedCount: 0, totalCount: 0 };

    const cell = pivotRow.cells[colKey]!;
    cell.totalCount += Number(row.observation_count);

    if (row.mm_was_omitted || !row.mm_code) cell.omittedCount += Number(row.observation_count);
    else {
      cell.mmCodes[row.mm_code] = (cell.mmCodes[row.mm_code] ?? 0) + Number(row.observation_count);
      if (!pivotRow.allMmCodes.includes(row.mm_code)) pivotRow.allMmCodes.push(row.mm_code);
    }
  }

  for (const pivotRow of map.values()) pivotRow.allMmCodes.sort();
  return Array.from(map.values()).sort((a, b) => {
    const catCmp = (a.drinkCategory ?? '').localeCompare(b.drinkCategory ?? '');
    if (catCmp !== 0) return catCmp;

    const skuCmp = a.skuCode.localeCompare(b.skuCode);
    if (skuCmp !== 0) return skuCmp;
    if (a.cupSize === 'regular' && b.cupSize === 'large') return -1;
    if (a.cupSize === 'large' && b.cupSize === 'regular') return 1;

    return 0;
  });
}

function CellContent({ cell }: { cell: CellData | undefined }) {
  if (!cell) return <span className="text-zinc-300 dark:text-zinc-700">-</span>;

  const mmEntries = Object.entries(cell.mmCodes).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-1 text-xs">
      {mmEntries.map(([code, count]) => (
        <div key={code} className="flex items-center gap-1.5">
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{code}</span>
          <span className="text-zinc-500">×{count}</span>
        </div>
      ))}
      {cell.omittedCount > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-500 dark:bg-zinc-800">omitted</span>
          <span className="text-zinc-500">×{cell.omittedCount}</span>
        </div>
      )}
    </div>
  );
}

function SummaryStats({ rows }: { rows: SweetnessAnalysisRow[] }) {
  const totalObs = rows.reduce((s, r) => s + Number(r.observation_count), 0);
  const uniqueSkus = new Set(rows.map((r) => r.sku_code)).size;
  const mmCodes = new Set(rows.filter((r) => r.mm_code).map((r) => r.mm_code!));
  const maxPreset = mmCodes.size > 0 ? Math.max(...Array.from(mmCodes).map((c) => parseInt(c.replace('mm', ''), 10))) : null;
  const omittedRows = rows.filter((r) => r.mm_was_omitted);
  const omittedObs = omittedRows.reduce((s, r) => s + Number(r.observation_count), 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        { label: 'Total observations', value: totalObs },
        { label: 'SKUs with data', value: uniqueSkus },
        { label: 'mm presets seen', value: mmCodes.size > 0 ? `${mmCodes.size} (highest: mm${String(maxPreset).padStart(3, '0')})` : '0' },
        { label: 'mm omitted', value: omittedObs > 0 ? `${omittedObs} (possibly "No Sugar")` : '0' }
      ].map(({ label, value }) => (
        <div key={label} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs text-zinc-500">{label}</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default async function AnalysisPage() {
  try {
    await requireSession(authConfig, { roles: ['admin'] });
  } catch (err: any) {
    console.error('[admin/analysis] session verification failed:', err);
    const code = err.code ? err.code.toLowerCase() : 'auth_failed';
    redirect(`/admin/login?error=${code}`);
  }

  const supabase = createPrivilegedSupabaseClient();
  const { data, error } = await supabase.from('sweetness_analysis').select('*');

  if (error) console.error('[analysis] query failed:', error.message);

  const rows = (data ?? []) as SweetnessAnalysisRow[];
  const pivot = buildPivot(rows);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sweetness Analysis</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">
            Each cell shows which <code className="font-mono text-xs">mm</code> preset(s) the machine used for that drink × sweetness combination, based on approved contributions. The goal is to find the pattern that cracks the formula.
          </p>
        </div>
        <Link href="/admin" className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
          ← Review queue
        </Link>
      </div>

      {/* Stats */}
      {rows.length > 0 && <SummaryStats rows={rows} />}

      {/* No data */}
      {pivot.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">
            No approved contributions yet. Approve some from the{' '}
            <Link href="/admin" className="underline underline-offset-2">
              review queue
            </Link>
            .
          </p>
        </div>
      )}

      {/* Pivot table */}
      {pivot.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">Drink</th>
                <th className="px-3 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">Size</th>
                {SWEETNESS_COLUMNS.map((col) => (
                  <th key={col.key} className="px-3 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pivot.map((row, i) => (
                <tr key={`${row.skuCode}-${row.cupSize}`} className={`border-b border-zinc-100 dark:border-zinc-800 ${i % 2 === 0 ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-50/50 dark:bg-zinc-900/50'}`}>
                  {/* Drink cell */}
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{row.drinkName ?? row.skuCode}</p>
                    <p className="text-[11px] text-zinc-400">
                      {row.skuCode}
                      {row.drinkCategory && ` · ${row.drinkCategory}`}
                    </p>
                  </td>

                  {/* Size cell */}
                  <td className="px-3 py-3 align-top text-zinc-500">{row.cupSize ? CUP_SIZE_LABELS[row.cupSize] : 'Any'}</td>

                  {/* Sweetness columns */}
                  {SWEETNESS_COLUMNS.map((col) => (
                    <td key={col.key} className="px-3 py-3 align-top">
                      <CellContent cell={row.cells[col.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      {pivot.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">How to read this table</p>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            <li>
              Each cell shows the <code className="rounded bg-amber-100 px-1 font-mono text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">mm</code> preset(s) the machine dispensed for that drink + sweetness combination.
            </li>
            <li>
              <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">omitted</code> means the QR code had no <code className="font-mono">mm</code> value - this likely maps to &ldquo;No Additional Sugar&rdquo;, but needs more data to
              confirm.
            </li>
            <li>
              ×<em>n</em> is the number of approved contributions that produced that code. Higher counts = more confidence.
            </li>
            <li>
              When the same sweetness level produces different <code className="font-mono">mm</code> codes across contributions, it may indicate a calibration change or a data error worth reviewing.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
