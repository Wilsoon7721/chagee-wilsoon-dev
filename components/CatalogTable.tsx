'use client';

import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import type { PublicDrink } from '@/lib/database.types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export function CatalogTable({ grouped }: { grouped: [string, PublicDrink[]][] }) {
  return (
    <div className="space-y-8">
      {grouped.map(([category, drinks]) => (
        <section key={category}>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">{category}</h2>

          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="overflow-x-auto">
              <motion.table className="w-full text-left text-sm" variants={container} initial="hidden" animate="show">
                <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium w-1/3">SKU</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium text-right">Verifications</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {drinks.map((drink) => (
                    <motion.tr key={drink.sku_code} variants={item} className="group transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-zinc-400">{drink.sku_code}</td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{drink.drink_name ?? <span className="italic text-zinc-400">Unnamed</span>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-end gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          {drink.verification_count}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </motion.table>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
