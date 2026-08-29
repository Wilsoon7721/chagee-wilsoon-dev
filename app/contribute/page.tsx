import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import ContributionForm from '@/components/contribution-form';

export const metadata: Metadata = {
  title: 'Contribute'
};

import { createServerSupabaseClient } from '@/lib/supabase';
import type { DynamicSkuMap } from '@/lib/qr-parser';
import type { PublicDrink } from '@/lib/database.types';

export default async function ContributePage() {
  const supabase = await createServerSupabaseClient();
  const { data: drinks } = await supabase.from('public_drinks').select('sku_code, drink_name, has_milk, uses_machine_milk, drink_category');

  const publicDrinks = drinks as PublicDrink[] | null;

  const dynamicSkus: DynamicSkuMap = {};
  for (const drink of publicDrinks ?? []) {
    if (drink.sku_code)
      dynamicSkus[drink.sku_code] = {
        name: drink.drink_name || '',
        hasMilk: drink.has_milk ?? false,
        usesMachineMilk: drink.uses_machine_milk ?? true,
        category: drink.drink_category || ''
      };
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50 cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
          Back to catalog
        </Link>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Contribute a QR code</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Scan the QR code on your CHAGEE cup sticker, then fill in what you ordered. Your data helps map Singapore SKUs and crack the sweetness formula.</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
        <div className="flex gap-3">
          <div className="mt-0.5 shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-500">Important Note</h3>
            <p className="text-sm leading-relaxed text-amber-700 dark:text-amber-400/90">
              Unfortunately, I can only accept QR code payloads starting from <strong>1 April 2026</strong>. This is because CHAGEE revamped their QR code system in March to include different milk types.
            </p>
          </div>
        </div>
      </div>

      <ol className="space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
        <li className="flex gap-2">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">1.</span>
          Scan the QR code on your cup sticker
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">2.</span>
          Confirm what you ordered (size, sweetness, ice, milk)
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">3.</span>
          Optionally upload a photo of the sticker
        </li>
      </ol>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      <ContributionForm dynamicSkus={dynamicSkus} />
    </div>
  );
}
