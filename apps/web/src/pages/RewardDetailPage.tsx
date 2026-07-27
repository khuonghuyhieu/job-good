import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { ApiClientError } from '../api/error-adapter.js';
import { RewardMedia } from '../entities/reward/RewardMedia.js';
import {
  getRewardDetail,
  redeemReward,
  redemptionHistoryQueryKey,
  rewardDetailQueryKey,
  rewardsQueryKey,
} from '../features/rewards/api.js';
import { RedemptionConfirmation } from '../features/rewards/RedemptionConfirmation.js';
import {
  walletLedgerQueryKey,
  walletOverviewQueryKey,
} from '../features/wallet/api.js';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  Eyebrow,
  Heading,
  Skeleton,
} from '../shared/ui/index.js';

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
        setConfirming(false);
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

  if (detail.isPending)
    return (
      <div
        className="mx-auto grid w-full max-w-5xl grid-cols-2 gap-6 max-mobile:grid-cols-1"
        role="status"
        aria-label="Loading reward"
      >
        <Skeleton className="min-h-96 rounded-gj-lg" />
        <Skeleton className="min-h-96 rounded-gj-lg" />
        <span className="sr-only">Loading reward…</span>
      </div>
    );
  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <ErrorState
          title="This reward is unavailable"
          description="No Reward Points have been spent."
          actionLabel="Retry reward"
          onAction={() => void detail.refetch()}
        />
      </div>
    );
  }
  const reward = detail.data;
  return (
    <main className="reward-detail mx-auto grid w-full max-w-5xl gap-5">
      <Link
        className="inline-flex min-h-11 w-fit items-center rounded-gj-sm px-3 font-bold text-gj-primary-700 no-underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-gj-focus"
        to="/rewards"
      >
        ← Back to catalog
      </Link>
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] gap-6 max-tablet:grid-cols-1">
        <Card as="section" className="overflow-hidden">
          <div className="mb-6">
            <RewardMedia imageUrl={reward.imageUrl} size="detail" />
          </div>
          <Eyebrow>Reward detail</Eyebrow>
          <Heading level={1} className="mt-2">
            {reward.name}
          </Heading>
          <p className="mt-4 mb-0 leading-7 text-gj-text-secondary">
            {reward.description ?? 'More details coming soon.'}
          </p>
        </Card>
        <Card
          as="section"
          className="grid content-start gap-5"
          aria-label="Redemption summary"
        >
          <Badge tone="warning" className="w-fit">
            {reward.costPoints} Reward Points
          </Badge>
          <div>
            <span className="text-gj-sm text-gj-text-secondary">
              Current Reward Balance
            </span>
            <strong className="mt-1 block text-gj-3xl text-gj-brand-700">
              {reward.eligibility.currentBalance}
            </strong>
          </div>
          {!reward.eligibility.eligible ? (
            <p
              className="m-0 rounded-gj-sm bg-gj-warning-subtle p-4 text-gj-sm font-semibold text-gj-warning"
              role="status"
            >
              You need more Reward Points for this reward.
            </p>
          ) : (
            <Button
              type="button"
              onClick={() => {
                redemption.reset();
                setConfirming(true);
              }}
            >
              Redeem reward
            </Button>
          )}
          <Link
            className="min-h-11 content-center text-center font-bold text-gj-primary-700"
            to="/wallet"
          >
            View Wallet and audit history
          </Link>
        </Card>
      </div>
      <RedemptionConfirmation
        open={confirming && !redemption.data}
        rewardName={reward.name}
        costPoints={reward.costPoints}
        currentBalance={reward.eligibility.currentBalance}
        pending={redemption.isPending}
        checking={recovery !== null}
        errorMessage={
          redemption.isError && recovery
            ? 'The result is still unknown. Check again using the same safe request.'
            : undefined
        }
        onClose={() => setConfirming(false)}
        onConfirm={() => submit(recovery ?? undefined)}
      />
      {redemption.isError && !recovery && (
        <div
          className={
            recovery
              ? 'rounded-gj-md border border-gj-warning/20 bg-gj-warning-subtle p-4 text-gj-sm text-gj-warning'
              : 'rounded-gj-md border border-gj-danger/20 bg-gj-danger-subtle p-4 text-gj-sm text-gj-danger'
          }
          role="alert"
        >
          {recovery
            ? 'The result is unknown. Check using the same safe request before trying a new redemption.'
            : redemption.error instanceof ApiClientError &&
                redemption.error.code === 'INSUFFICIENT_REWARD_POINTS'
              ? 'Your latest Reward Point balance is insufficient.'
              : 'The reward could not be redeemed. Please review the latest details.'}
        </div>
      )}
      {recovery && !confirming && (
        <Card as="section" aria-labelledby="redemption-recovery-title">
          <Heading id="redemption-recovery-title" level={2}>
            Check pending redemption
          </Heading>
          <p className="text-gj-text-secondary">
            The previous result is unknown. Check it before starting another
            redemption.
          </p>
          <Button type="button" onClick={() => setConfirming(true)}>
            Check redemption result
          </Button>
        </Card>
      )}
      {redemption.data && (
        <Card
          as="section"
          className="border-gj-success/20 bg-gj-success-subtle text-gj-success"
          role="status"
        >
          <Heading level={2}>
            Redemption committed. Balance: {redemption.data.balanceAfter} Reward
            Points.
          </Heading>
          <p className="mb-0">
            Server-confirmed balance: {redemption.data.balanceAfter} Reward
            Points.
          </p>
        </Card>
      )}
    </main>
  );
}
