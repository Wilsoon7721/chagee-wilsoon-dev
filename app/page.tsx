import type { Metadata } from 'next';
import Link from 'next/link';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { PublicDrink } from '@/lib/database.types';
import { CatalogTable } from '@/components/CatalogTable';

export const metadata: Metadata = {
  title: 'Drink Catalog'
};

function groupByCategory(drinks: PublicDrink[]): Map<string, PublicDrink[]> {
  const sorted = new Map<string, PublicDrink[]>();
  sorted.set('Drinks', []);
  sorted.set('Bakery, Cakes & Special', []);

  for (const drink of drinks) {
    const sku = drink.sku_code || '';
    const cat = drink.drink_category || '';
    const type = drink.sku_type || '';

    const isSpecial = sku === 'SGSTC001' || cat === 'Special' || type === 'special';
    const isCake = sku.startsWith('SGC') || cat === 'Cake' || type === 'cake';
    const isBakery = cat === 'Bakery' || type === 'bakery' || type === 'unknown' || (cat === 'Other' && type !== 'regular' && type !== 'limited');

    if (isSpecial || isCake || isBakery) sorted.get('Bakery, Cakes & Special')!.push(drink);
    else {
      sorted.get('Drinks')!.push(drink);
    }
  }

  // Remove empty groups
  const finalMap = new Map<string, PublicDrink[]>();
  for (const [key, val] of sorted.entries()) {
    if (val.length > 0) finalMap.set(key, val);
  }

  return finalMap;
}

export default async function CatalogPage() {
  const supabase = await createServerSupabaseClient();

  const { data: drinks, error } = await supabase.from('public_drinks').select('*').order('drink_name');

  if (error) console.error('[catalog] failed to load drinks:', error.message);

  const grouped = groupByCategory(drinks ?? []);
  const totalDrinks = drinks?.length ?? 0;

  return (
    <div className="space-y-10 pt-8 sm:pt-16">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Singapore Drink Catalog</h1>
          <p className="max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">Community-verified CHAGEE Singapore SKU mappings. Each entry is confirmed through at least one approved QR code contribution.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="space-y-1">
            <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Help us map more drinks</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Currently tracking <span className="font-semibold text-zinc-900 dark:text-zinc-50">{totalDrinks}</span> {totalDrinks === 1 ? 'drink' : 'drinks'}. Found a QR code not in the list?
            </p>
          </div>
          <Link
            href="/contribute"
            className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 cursor-pointer shrink-0">
            Add your QR code →
          </Link>
        </div>
      </div>

      {/* No data state */}
      {totalDrinks === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">No verified drinks yet.</p>
          <Link href="/contribute" className="mt-2 inline-block text-sm font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-50">
            Be the first to contribute
          </Link>
        </div>
      )}

      {/* Grouped catalog */}
      {totalDrinks > 0 && <CatalogTable grouped={Array.from(grouped.entries())} />}

      {/* FAQ / Info Section */}
      <div id="faq" className="mt-16 space-y-8 rounded-2xl border border-zinc-200 bg-zinc-50/50 p-6 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">What is this for?</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            I&apos;m trying to figure out the QR code payloads to automatically map macronutrient counts (like calories) using just the QR code on your cup. Doing so requires understanding the underlying formula, including how the bar machine at
            CHAGEE derives its values. Since I don&apos;t want to have to get the values by drinking everything on CHAGEE&apos;s menu, I need your help to crowdsource these QR codes.
          </p>
        </div>

        <div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">What does scanning the QR code actually share?</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            <strong>No personal data is shared.</strong> The bar machine at CHAGEE doesn&apos;t care about your personal data either. The payload strictly represents order-specific data, such as:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>An internal transaction ID (representing how many transactions the outlet has completed for the current day, which is shared across all cups in your order)</li>
            <li>The actual Item SKU</li>
            <li>Milk Type</li>
            <li>Ice Level</li>
            <li>Sweetness Level</li>
          </ul>
        </div>

        <div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">What will you do after you get this information?</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            I am doing the survey simply to get the data to confirm the actual relationships. Once I&apos;m able to confirm the mappings, I plan to create an open-source tool that allows just the QR code to show the item ordered and its details.
          </p>
        </div>
      </div>
    </div>
  );
}
