import { Injectable } from '@nestjs/common';
import type { WalletOverviewResponse } from '@good-job/contracts';
import { database } from '@good-job/database';

import type { AuthenticatedPrincipal } from '../../../auth/authenticated-principal.js';
import { resolveBusinessMonth } from '../../domain/business-month.js';

export function toWalletOverview(
  businessMonth: string,
  budget: { allowancePoints: number; usedPoints: number },
  rewardBalance: number,
): WalletOverviewResponse {
  return {
    businessMonth,
    givingBudget: {
      allowance: 200,
      used: budget.usedPoints,
      remaining: budget.allowancePoints - budget.usedPoints,
    },
    rewardBalance,
  };
}

@Injectable()
export class GetGivingBudgetQuery {
  async execute(
    principal: AuthenticatedPrincipal,
    instant = new Date(),
  ): Promise<WalletOverviewResponse> {
    const businessMonth = resolveBusinessMonth(
      principal.organization.timezone,
      instant,
    );
    await Promise.all([
      database.$executeRaw`
        INSERT INTO "monthly_giving_budgets" (
          "id",
          "employee_id",
          "business_month",
          "allowance_points",
          "used_points",
          "created_at",
          "updated_at"
        )
        VALUES (
          gen_random_uuid(),
          ${principal.employeeId}::uuid,
          ${businessMonth},
          200,
          0,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("employee_id", "business_month") DO NOTHING
      `,
      database.$executeRaw`
        INSERT INTO "reward_point_accounts" (
          "id",
          "employee_id",
          "current_balance",
          "created_at",
          "updated_at"
        )
        VALUES (
          gen_random_uuid(),
          ${principal.employeeId}::uuid,
          0,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("employee_id") DO NOTHING
      `,
    ]);
    const [budget, rewardAccount] = await Promise.all([
      database.monthlyGivingBudget.findUniqueOrThrow({
        where: {
          employeeId_businessMonth: {
            employeeId: principal.employeeId,
            businessMonth,
          },
        },
      }),
      database.rewardPointAccount.findUniqueOrThrow({
        where: { employeeId: principal.employeeId },
      }),
    ]);

    return toWalletOverview(
      businessMonth,
      budget,
      rewardAccount.currentBalance,
    );
  }
}
