'use client';

import { submitContribution } from '@/app/actions/submit-contribution';
import type { ParsedQrPayload } from '@/lib/database.types';
import { decodeCupSize, decodeIceLevel, decodeMilkType, detectAnomalies, extractSweetnessPreset, getKnownDrinkName, getSkuType, isKnownSku, parseQrPayload, type PayloadAnomaly } from '@/lib/qr-parser';
import { Turnstile } from '@marsidev/react-turnstile';
import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import QrScanner from './qr-scanner';

type Step = 'scan' | 'form' | 'done';
function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs text-red-600 dark:text-red-400">{message}</p>;
}

const inputClass =
  'mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-400 dark:focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60';

const selectClass = inputClass;

function AnomalyBadge({ anomaly }: { anomaly: PayloadAnomaly }) {
  const colours = {
    critical: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-900',
    info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:ring-blue-900'
  };
  const labels = { critical: 'Critical', warning: 'Warning', info: 'Info' };
  return (
    <div className={`flex gap-2 rounded-lg px-3 py-2 text-sm ring-1 ${colours[anomaly.severity]}`}>
      <span className="shrink-0 font-semibold">{labels[anomaly.severity]}:</span>
      <span>{anomaly.message}</span>
    </div>
  );
}

function ParsedSummary({ parsed }: { parsed: ParsedQrPayload }) {
  const rows: Array<[string, string | null]> = [
    ['Transaction', parsed.tValue],
    ['SKU', parsed.skuValue],
    ['Known Item', getKnownDrinkName(parsed.skuValue)],
    ['Cup Size', decodeCupSize(parsed.aValue) ?? parsed.aValue ?? '-'],
    ['Milk', decodeMilkType(parsed.cValue) ?? parsed.cValue ?? '-'],
    ['Ice', decodeIceLevel(parsed.mValue) ?? parsed.mValue ?? '-'],
    ['Sweetness Preset', extractSweetnessPreset(parsed.mmValue) != null ? `mm${String(extractSweetnessPreset(parsed.mmValue)).padStart(3, '0')} (preset ${extractSweetnessPreset(parsed.mmValue)})` : '- (omitted)'],
    ['Raw Payload', parsed.raw]
  ];

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">Decoded QR</p>
      <dl className="space-y-1">
        {rows.map(([key, val]) => (
          <div key={key} className="flex gap-2 text-sm">
            <dt className="w-36 shrink-0 text-zinc-500">{key}</dt>
            <dd className="font-mono text-zinc-900 break-all dark:text-zinc-100">{val ?? <span className="italic text-zinc-400">Unknown</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function ContributionForm() {
  const [step, setStep] = useState<Step>('scan');
  const [parsed, setParsed] = useState<ParsedQrPayload | null>(null);
  const [anomalies, setAnomalies] = useState<PayloadAnomaly[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isBakeryOrCake = parsed ? getSkuType(parsed.skuValue) === 'cake' || getSkuType(parsed.skuValue) === 'bakery' || getSkuType(parsed.skuValue) === 'unknown' : false;

  function handleScan(raw: string) {
    const result = parseQrPayload(raw);
    if (!result.success) {
      setParseError(result.error.message);
      return;
    }

    setParseError(null);
    setParsed(result.data);
    setAnomalies(detectAnomalies(result.data));
    setStep('form');
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!parsed) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      setSubmitError(null);
      const result = await submitContribution(formData);
      if (result.success) setStep('done');
      else {
        setSubmitError(result.error ?? 'Something went wrong. Please try again.');
        setTurnstileKey((k) => k + 1);
      }
    });
  }

  function resetToScan() {
    setParsed(null);
    setAnomalies([]);
    setParseError(null);
    setSubmitError(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setStep('scan');
  }

  if (step === 'done')
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl dark:bg-green-900/40">✓</div>
        <h2 className="text-lg font-semibold">Contribution submitted!</h2>
        <p className="max-w-sm text-sm text-zinc-500">Your QR code data is now in the review queue. Once verified, it will appear in the public catalog.</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <button onClick={resetToScan} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer">
            Submit another
          </button>
          <Link
            href="/"
            className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900 cursor-pointer">
            Back to catalog
          </Link>
        </div>
      </div>
    );

  if (step === 'scan')
    return (
      <div className="space-y-4">
        <QrScanner onScan={handleScan} />
        {parseError && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900">
            <span className="font-semibold">Could not read this code: </span>
            {parseError}
          </div>
        )}
      </div>
    );

  return (
    <div className="space-y-6">
      {parsed && <ParsedSummary parsed={parsed} />}

      {/* Anomaly alerts */}
      {anomalies.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Notices</p>
          {anomalies.map((a, i) => (
            <AnomalyBadge key={i} anomaly={a} />
          ))}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <input type="hidden" name="rawPayload" value={parsed?.raw ?? ''} />

        {/* Drink name */}
        <div className="space-y-3">
          <Label htmlFor="reportedDrinkName">
            Item Name <span className="text-red-500">*</span>
          </Label>
          {isBakeryOrCake && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
              <p className="text-sm leading-relaxed text-blue-700 dark:text-blue-400/90">Notice: Since this looks like a cake or bakery item, you only need to fill in the Item Name. You can ignore the other fields.</p>
            </div>
          )}
          <input id="reportedDrinkName" name="reportedDrinkName" type="text" required placeholder="e.g. Peach Oolong Milk Tea" defaultValue={parsed ? (getKnownDrinkName(parsed.skuValue) ?? '') : ''} className={inputClass} disabled={isPending} />
        </div>

        {/* Size + Sweetness row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reportedSize">Cup size</Label>
            <select id="reportedSize" name="reportedSize" className={selectClass} disabled={isPending} defaultValue={parsed?.aValue === 'A001' ? 'large' : parsed?.aValue === 'A002' ? 'regular' : ''}>
              <option value="regular">Regular</option>
              <option value="large">Large</option>
            </select>
          </div>

          <div>
            <Label htmlFor="reportedSweetness">Sweetness level</Label>
            <select id="reportedSweetness" name="reportedSweetness" className={selectClass} disabled={isPending} defaultValue="" required={!!parsed?.mmValue}>
              <option value="" disabled={!!parsed?.mmValue}>
                {parsed?.mmValue ? 'Select Sweetness Level' : 'Not Applicable'}
              </option>
              <option value="normal">Normal Sweet</option>
              <option value="less">Less Sweet</option>
              <option value="slightly">Slightly Sweet</option>
              <option value="none">No Additional Sugar</option>
            </select>
          </div>
        </div>

        {/* Ice + Milk row */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="reportedIce">Ice level</Label>
            <select id="reportedIce" name="reportedIce" className={selectClass} disabled={isPending} defaultValue={parsed?.mValue === 'm001' ? 'normal' : parsed?.mValue === 'm002' ? 'less' : parsed?.mValue === 'm003' ? 'none' : ''}>
              <option value="" disabled>
                Select Ice Level
              </option>
              <option value="normal">Normal Ice</option>
              <option value="less">Less Ice</option>
              <option value="none">No Ice</option>
              <option value="hot">Hot</option>
            </select>
          </div>

          <div>
            <Label htmlFor="reportedMilkType">Milk type</Label>
            <select
              id="reportedMilkType"
              name="reportedMilkType"
              className={selectClass}
              disabled={isPending}
              defaultValue={parsed?.cValue === 'C001' ? 'Regular Fresh Milk' : parsed?.cValue === 'C002' ? 'Oat Milk' : parsed?.cValue === 'C003' ? 'Non-Fat Milk' : ''}>
              <option value="">No Milk / Not Applicable</option>
              <option value="Regular Fresh Milk">Regular Fresh Milk</option>
              <option value="Oat Milk">Oat Milk</option>
              <option value="Non-Fat Milk">Non-Fat Milk</option>
            </select>
          </div>
        </div>

        {/* Sticker photo */}
        <div>
          <Label htmlFor="imageFile">Sticker photo {!parsed || !isKnownSku(parsed.skuValue) ? <span className="text-red-500">*</span> : <span className="text-zinc-500 font-normal ml-1">(Required if modifying)</span>}</Label>
          <p className="mb-1 text-xs text-zinc-500">A photo of the cup sticker. The QR code does not need to be readable, but the sticker should be legible.</p>
          <input
            ref={fileRef}
            id="imageFile"
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleImageChange}
            className="mt-1 w-full text-sm text-zinc-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-300 dark:hover:file:bg-zinc-700"
            disabled={isPending}
          />
          {previewUrl && <img src={previewUrl} alt="Sticker preview" className="mt-2 max-h-40 rounded-lg object-contain" />}
        </div>

        {/* Submit error */}
        {submitError && (
          <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900">
            {submitError}
          </div>
        )}

        <Turnstile key={turnstileKey} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} options={{ action: 'submit_contribution' }} />

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className={`rounded-xl ${isPending ? 'cursor-not-allowed' : 'cursor-pointer'} bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200`}>
            {isPending ? 'Submitting...' : 'Submit contribution'}
          </button>
          <button type="button" onClick={resetToScan} disabled={isPending} className={`text-sm ${isPending ? 'cursor-not-allowed' : 'cursor-pointer'} text-zinc-500 underline underline-offset-2 hover:no-underline disabled:opacity-50`}>
            Scan again
          </button>
        </div>
      </form>
    </div>
  );
}
