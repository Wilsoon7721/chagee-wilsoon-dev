'use server';

import { createPrivilegedSupabaseClient, BUCKET_NAME } from '@/lib/supabase';
import { parseQrPayload, getSkuType, getKnownDrinkName, isKnownSku } from '@/lib/qr-parser';
import type { CupSize, IceLevel, SweetnessLevel } from '@/lib/database.types';
import { headers } from 'next/headers';

export interface SubmitResult {
  success: boolean;
  error?: string;
  contributionId?: string;
}

export async function submitContribution(formData: FormData): Promise<SubmitResult> {
  const rawPayload = (formData.get('rawPayload') as string | null)?.trim() ?? '';
  const reportedDrinkName = (formData.get('reportedDrinkName') as string | null)?.trim() ?? '';
  const reportedSize = formData.get('reportedSize') as CupSize | null;
  const reportedSweetness = formData.get('reportedSweetness') as SweetnessLevel | null;
  const reportedIce = formData.get('reportedIce') as IceLevel | null;
  const reportedMilkType = (formData.get('reportedMilkType') as string | null)?.trim() || null;
  const imageFile = formData.get('imageFile') as File | null;
  const userAgentHeader = (await headers()).get('user-agent') ?? '';

  if (!rawPayload) return { success: false, error: 'QR payload is missing.' };
  if (!reportedDrinkName) return { success: false, error: 'Drink name is required.' };

  const parseResult = parseQrPayload(rawPayload);
  if (!parseResult.success) return { success: false, error: `Invalid QR payload: ${parseResult.error.message}` };

  const parsed = parseResult.data;

  const isKnown = isKnownSku(parsed.skuValue);
  const defaultDrinkName = getKnownDrinkName(parsed.skuValue) ?? '';
  const defaultSize = parsed.aValue === 'A001' ? 'large' : 'regular';
  const defaultIce = parsed.mValue === 'm001' ? 'normal' : parsed.mValue === 'm002' ? 'less' : parsed.mValue === 'm003' ? 'none' : '';
  const defaultMilk = parsed.cValue === 'C001' ? 'Regular Fresh Milk' : parsed.cValue === 'C002' ? 'Oat Milk' : parsed.cValue === 'C003' ? 'Non-Fat Milk' : '';

  const skuType = getSkuType(parsed.skuValue);
  const isBakeryOrCakeOrSpecial = skuType === 'cake' || skuType === 'bakery' || skuType === 'special' || skuType === 'unknown';

  let isModified = false;
  if (!isKnown) isModified = true;
  else if (isBakeryOrCakeOrSpecial) isModified = reportedDrinkName !== defaultDrinkName;
  else {
    isModified = reportedDrinkName !== defaultDrinkName || (reportedSize || 'regular') !== defaultSize || (reportedIce || '') !== defaultIce || (reportedMilkType || '') !== defaultMilk;
  }

  if (isModified && (!imageFile || imageFile.size === 0)) return { success: false, error: 'A sticker photo is required if you modify the autofilled values (or for unmapped items).' };

  const forwardedFor = (await headers()).get('x-forwarded-for') ?? '';
  const ip = forwardedFor.split(',')[0]?.trim() || 'unknown';

  // Use Web Crypto API for full Edge/Cloudflare Workers compatibility
  const encoder = new TextEncoder();
  const ipData = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest('SHA-256', ipData);
  const ipHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const turnstileToken = (formData.get('cf-turnstile-response') as string | null)?.trim();
  if (!turnstileToken) return { success: false, error: 'Please complete the CAPTCHA.' };

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY!,
        response: turnstileToken,
        remoteip: ip !== 'unknown' ? ip : ''
      })
    });
    if (!r.ok) throw new Error(`siteverify ${r.status}`);

    const result = await r.json();
    if (!result.success || result.action !== 'submit_contribution') return { success: false, error: `CAPTCHA verification failed: ${JSON.stringify(result['error-codes'])}` };
  } catch (err: any) {
    return { success: false, error: `CAPTCHA verification failed: ${err.message}` };
  }

  let imagePath: string | null = null;
  let imageUrl: string | null = null;

  if (imageFile && imageFile.size > 0) {
    if (imageFile.size > 10 * 1024 * 1024) return { success: false, error: 'Image must be smaller than 10 MB.' };

    const ext = imageFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
    if (!allowed.includes(ext)) return { success: false, error: 'Image must be a JPG, PNG, WebP, or HEIC file.' };

    const supabase = createPrivilegedSupabaseClient();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    imagePath = `contributions/${parsed.skuValue}/${fileName}`;

    const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(imagePath, imageFile, { contentType: imageFile.type, upsert: false });

    if (uploadError) {
      console.error('[submit] image upload failed:', uploadError.message);
      return { success: false, error: `Image upload failed: ${uploadError.message}` };
    }

    const { data: signedData } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(imagePath, 60 * 60 * 24 * 365 * 10);
    imageUrl = signedData?.signedUrl ?? null;
  }

  const supabase = createPrivilegedSupabaseClient() as any;
  const { data, error: insertError } = await supabase
    .from('contributions')
    .insert({
      raw_payload: rawPayload,
      t_value: parsed.tValue,
      sku_value: parsed.skuValue,
      sku_type: getSkuType(parsed.skuValue),
      segment_3_raw: parsed.segment3Raw,
      a_value: parsed.aValue,
      c_value: parsed.cValue,
      m_value: parsed.mValue,
      mm_value: parsed.mmValue,
      reported_drink_name: reportedDrinkName,
      reported_size: reportedSize,
      reported_sweetness: reportedSweetness,
      reported_ice: reportedIce,
      reported_milk_type: reportedMilkType,
      image_storage_path: imagePath,
      image_url: imageUrl,
      submitter_ip_hash: ipHash,
      user_agent: userAgentHeader,
      status: 'pending'
    } as object)
    .select('id')
    .single();

  if (insertError) {
    console.error('[submit] insert failed:', insertError.message);
    return { success: false, error: `Submission failed: ${insertError.message}` };
  }

  return { success: true, contributionId: (data as any).id };
}
