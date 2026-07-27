import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiClientError } from '../api/error-adapter.js';
import {
  getRewardDetail,
  redeemReward,
  redemptionHistoryQueryKey,
  rewardDetailQueryKey,
  rewardsQueryKey,
} from '../features/rewards/api.js';
import {
  walletLedgerQueryKey,
  walletOverviewQueryKey,
} from '../features/wallet/api.js';

type Attempt = { rewardId: string; key: string };

function isUnknownResult(error: unknown): boolean {
  return (
    !(error instanceof ApiClientError) ||
    error.status >= 500 ||
    error.code === 'UNEXPECTED_RESPONSE'
  );
}

export function RewardDetailPage() {
  const { rewardId = '' } = useParams();
  const queryClient = useQueryClient();
  const submitting = useRef(false);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [recovery, setRecovery] = useState<Attempt | null>(null);
  const detail = useQuery({
    queryKey: rewardDetailQueryKey(rewardId),
    queryFn: () => getRewardDetail(rewardId),
    enabled: Boolean(rewardId),
  });
  const redemption = useMutation({
    mutationFn: (attempt: Attempt) =>
      redeemReward(attempt.rewardId, attempt.key),
    onSuccess: async () => {
      setRecovery(null);
      setConfirming(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: walletOverviewQueryKey }),
        queryClient.invalidateQueries({ queryKey: walletLedgerQueryKey }),
        queryClient.invalidateQueries({ queryKey: redemptionHistoryQueryKey }),
        queryClient.invalidateQueries({ queryKey: rewardsQueryKey }),
      ]);
    },
    onError: async (error, attempt) => {
      if (isUnknownResult(error)) setRecovery(attempt);
      else setRecovery(null);
      if (
        error instanceof ApiClientError &&
        (error.code === 'INSUFFICIENT_REWARD_POINTS' ||
          error.code === 'REWARD_UNAVAILABLE')
      ) {
        await detail.refetch();
      }
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  const submit = (attempt?: Attempt) => {
    if (submitting.current || redemption.isPending) return;
    submitting.current = true;
    redemption.mutate(attempt ?? { rewardId, key: crypto.randomUUID() });
  };

  useEffect(() => {
    if (!confirming) return;
    confirmButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !redemption.isPending && !recovery) {
        setConfirming(false);
      }
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled)',
        ),
      );
      const first = controls.at(0);
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirming, recovery, redemption.isPending]);

  if (detail.isPending) return <p role="status">Loading reward…</p>;
  if (detail.isError || !detail.data) {
    return (
      <div role="alert">
        <p>This reward is unavailable.</p>
        <button type="button" onClick={() => void detail.refetch()}>
          Retry reward
        </button>
      </div>
    );
  }
  const reward = detail.data;
  return (
    <section className="reward-detail">
      <Link to="/rewards">Back to catalog</Link>
      <h1>{reward.name}</h1>
      <p>{reward.description}</p>
      <p>
        Cost: <strong>{reward.costPoints} Reward Points</strong>
      </p>
      <p>Current balance: {reward.eligibility.currentBalance}</p>
      {!reward.eligibility.eligible ? (
        <p role="status">You need more Reward Points for this reward.</p>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          Redeem reward
        </button>
      )}
      {confirming && !redemption.data && (
        <div
          ref={dialog}
          className="confirmation-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="redeem-title"
        >
          <h2 id="redeem-title">Confirm redemption</h2>
          <p>
            Redeem {reward.name} for {reward.costPoints} Reward Points?
          </p>
          <p>
            Expected balance:{' '}
            {reward.eligibility.currentBalance - reward.costPoints}. The server
            will confirm your latest balance.
          </p>
          <button
            ref={confirmButton}
            type="button"
            disabled={redemption.isPending}
            onClick={() => submit(recovery ?? undefined)}
          >
            {redemption.isPending
              ? recovery
                ? 'Checking redemption…'
                : 'Redeeming…'
              : recovery
                ? 'Check redemption result'
                : 'Confirm redemption'}
          </button>
          <button
            type="button"
            disabled={redemption.isPending || recovery !== null}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </div>
      )}
      {redemption.isError && (
        <div role="alert">
          {recovery
            ? 'The result is unknown. Check using the same safe request before trying a new redemption.'
            : redemption.error instanceof ApiClientError &&
                redemption.error.code === 'INSUFFICIENT_REWARD_POINTS'
              ? 'Your latest Reward Point balance is insufficient.'
              : 'The reward could not be redeemed. Please review the latest details.'}
        </div>
      )}
      {recovery && !confirming && (
        <section aria-labelledby="redemption-recovery-title">
          <h2 id="redemption-recovery-title">Check pending redemption</h2>
          <p>
            The previous result is unknown. Check it before starting another
            redemption.
          </p>
          <button type="button" onClick={() => setConfirming(true)}>
            Check redemption result
          </button>
        </section>
      )}
      {redemption.data && (
        <div role="status">
          Redemption committed. Balance: {redemption.data.balanceAfter} Reward
          Points.
        </div>
      )}
    </section>
  );
}
