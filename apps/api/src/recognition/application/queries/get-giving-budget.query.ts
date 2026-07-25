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
    const [budget, rewardAccount] = await Promise.all([
      database.monthlyGivingBudget.upsert({
        where: {
          employeeId_businessMonth: {
            employeeId: principal.employeeId,
            businessMonth,
          },
        },
        update: {},
        create: {
          employeeId: principal.employeeId,
          businessMonth,
          allowancePoints: 200,
          usedPoints: 0,
        },
      }),
      database.rewardPointAccount.findUnique({
        where: { employeeId: principal.employeeId },
        select: { currentBalance: true },
      }),
    ]);

    return toWalletOverview(
      businessMonth,
      budget,
      rewardAccount?.currentBalance ?? 0,
    );
  }
}
