import type { WalletOverviewResponse } from '@good-job/contracts';

import { givingBudgetExplanation } from './points-copy.js';
import { Card, Eyebrow, Heading } from '../../shared/ui/index.js';

export function GivingBudgetSummary({
  overview,
}: {
  overview: WalletOverviewResponse;
}) {
  return (
    <Card
      as="section"
      className="grid content-start gap-4 border-gj-primary-500/20 bg-gj-primary-100"
      aria-labelledby="wallet-giving-title"
    >
      <Eyebrow>{overview.businessMonth}</Eyebrow>
      <Heading id="wallet-giving-title" level={2}>
        Giving Budget
      </Heading>
      <strong className="text-gj-3xl text-gj-primary-700">
        {overview.givingBudget.remaining} points remaining
      </strong>
      <div
        className="h-2 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-label="Giving Budget used"
        aria-valuemin={0}
        aria-valuemax={overview.givingBudget.allowance}
        aria-valuenow={overview.givingBudget.used}
      >
        <span
          className="block h-full rounded-full bg-gj-primary-600"
          style={{
            width: `${Math.min(
              100,
              (overview.givingBudget.used / overview.givingBudget.allowance) *
                100,
            )}%`,
          }}
        />
      </div>
      <p className="m-0 text-gj-sm text-gj-text-secondary">
        {givingBudgetExplanation}
      </p>
      <p className="m-0 text-gj-sm font-bold text-gj-brand-700">
        {overview.givingBudget.used} used of {overview.givingBudget.allowance}
      </p>
    </Card>
  );
}
