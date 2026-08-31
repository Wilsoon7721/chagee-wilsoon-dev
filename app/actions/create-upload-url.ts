'use server';

import { createPrivilegedSupabaseClient, BUCKET_NAME } from '@/lib/supabase';

export interface UploadUrlResult {
  success: boolean;
  error?: string;
  signedUrl?: string;
  token?: string;
  path?: string;
}

/**
 * Generate a signed upload URL for a contribution image.
 */
export async function createUploadUrl(skuValue: string, fileName: string): Promise<UploadUrlResult> {
  if (!skuValue || !fileName) return { success: false, error: 'SKU and filename are required.' };

  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const allowed = ['jpg', 'jpeg', 'png', 'webp', 'heic'];
  if (!allowed.includes(ext)) return { success: false, error: 'Image must be a JPG, PNG, WebP, or HEIC file.' };

  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const path = `contributions/${skuValue}/${safeName}`;

  const supabase = createPrivilegedSupabaseClient();
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUploadUrl(path);

  if (error || !data) {
    console.error('[create-upload-url] failed:', error?.message);
    return { success: false, error: `Failed to create upload URL: ${error?.message ?? 'unknown error'}` };
  }

  return { success: true, signedUrl: data.signedUrl, token: data.token, path };
}
