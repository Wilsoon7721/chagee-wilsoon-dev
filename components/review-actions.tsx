'use client';

import { useState, useTransition } from 'react';
import { approveContribution, rejectContribution } from '@/app/actions/review-contribution';

interface ReviewActionsProps {
  id: string;
}

export default function ReviewActions({ id }: ReviewActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  if (done === 'approved') return <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">✓ Approved</span>;
  if (done === 'rejected') return <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">✕ Rejected</span>;

  function handleApprove() {
    startTransition(async () => {
      setError(null);
      const result = await approveContribution(id);
      if (result.success) setDone('approved');
      else setError(result.error ?? 'Failed');
    });
  }

  function handleReject() {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await rejectContribution(id, rejectNote || undefined);
      if (result.success) setDone('rejected');
      else setError(result.error ?? 'Failed');
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={handleApprove} disabled={isPending} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? '...' : 'Approve'}
        </button>
        <button onClick={handleReject} disabled={isPending} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">
          {isPending ? '...' : showRejectInput ? 'Confirm reject' : 'Reject'}
        </button>
        {showRejectInput && (
          <button onClick={() => setShowRejectInput(false)} disabled={isPending} className="text-sm text-zinc-400 underline underline-offset-2 hover:no-underline">
            Cancel
          </button>
        )}
      </div>

      {showRejectInput && (
        <input
          type="text"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="Rejection note (optional)"
          disabled={isPending}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-600"
        />
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
