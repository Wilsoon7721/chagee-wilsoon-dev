'use server';

import { createPrivilegedSupabaseClient } from '@/lib/supabase';
import { requireSession } from '@wilsoon/auth-next/server';
import { authConfig } from '@/lib/auth-config';
import { revalidatePath } from 'next/cache';

async function assertAdmin() {
  await requireSession(authConfig, { roles: ['admin'] });
}

export interface ReviewResult {
  success: boolean;
  error?: string;
}

export async function approveContribution(id: string): Promise<ReviewResult> {
  await assertAdmin();

  const supabase = createPrivilegedSupabaseClient();
  const { error } = await supabase.from('contributions').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', id);

  if (error) {
    console.error('[review] approve failed:', error.message);
    return { success: false, error: 'Failed to approve. Please try again.' };
  }

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function rejectContribution(id: string, note?: string): Promise<ReviewResult> {
  await assertAdmin();

  const supabase = createPrivilegedSupabaseClient();
  const { error } = await supabase
    .from('contributions')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), review_notes: note ?? null })
    .eq('id', id);

  if (error) {
    console.error('[review] reject failed:', error.message);
    return { success: false, error: 'Failed to reject. Please try again.' };
  }

  revalidatePath('/admin');
  return { success: true };
}
