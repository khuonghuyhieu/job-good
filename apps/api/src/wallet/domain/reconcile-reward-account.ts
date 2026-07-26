export type ReconciliationEntry = {
  id: string;
  sequence: number;
  direction: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
};

export type ReconciliationIssue =
  | {
      code: 'SEQUENCE_GAP';
      entryId: string;
      expectedSequence: number;
      actualSequence: number;
    }
  | {
      code: 'NEGATIVE_SEQUENCE';
      entryId: string;
      calculatedBalance: number;
    }
  | {
      code: 'BALANCE_AFTER_MISMATCH';
      entryId: string;
      expectedBalanceAfter: number;
      actualBalanceAfter: number;
    }
  | {
      code: 'MISSING_ACCOUNT';
      calculatedBalance: number;
    }
  | {
      code: 'ACCOUNT_PROJECTION_MISMATCH';
      calculatedBalance: number;
      accountBalance: number;
    }
  | {
      code: 'ACCOUNT_SEQUENCE_MISMATCH';
      ledgerSequence: number;
      accountSequence: number;
    };

export type RewardAccountReconciliation = {
  reconciled: boolean;
  calculatedBalance: number;
  accountBalance: number | null;
  ledgerSequence: number;
  accountSequence: number | null;
  issues: ReconciliationIssue[];
};

export function reconcileRewardAccount(
  account: { currentBalance: number; ledgerSequence: number } | null,
  entries: ReconciliationEntry[],
): RewardAccountReconciliation {
  let calculatedBalance = 0;
  const issues: ReconciliationIssue[] = [];

  for (const [index, entry] of entries.entries()) {
    const expectedSequence = index + 1;
    if (entry.sequence !== expectedSequence) {
      issues.push({
        code: 'SEQUENCE_GAP',
        entryId: entry.id,
        expectedSequence,
        actualSequence: entry.sequence,
      });
    }
    calculatedBalance +=
      entry.direction === 'credit' ? entry.amount : -entry.amount;
    if (calculatedBalance < 0) {
      issues.push({
        code: 'NEGATIVE_SEQUENCE',
        entryId: entry.id,
        calculatedBalance,
      });
    }
    if (calculatedBalance !== entry.balanceAfter) {
      issues.push({
        code: 'BALANCE_AFTER_MISMATCH',
        entryId: entry.id,
        expectedBalanceAfter: calculatedBalance,
        actualBalanceAfter: entry.balanceAfter,
      });
    }
  }

  const ledgerSequence = entries.at(-1)?.sequence ?? 0;
  if (!account) {
    if (entries.length > 0) {
      issues.push({ code: 'MISSING_ACCOUNT', calculatedBalance });
    }
  } else {
    if (calculatedBalance !== account.currentBalance) {
      issues.push({
        code: 'ACCOUNT_PROJECTION_MISMATCH',
        calculatedBalance,
        accountBalance: account.currentBalance,
      });
    }
    if (ledgerSequence !== account.ledgerSequence) {
      issues.push({
        code: 'ACCOUNT_SEQUENCE_MISMATCH',
        ledgerSequence,
        accountSequence: account.ledgerSequence,
      });
    }
  }

  return {
    reconciled: issues.length === 0,
    calculatedBalance,
    accountBalance: account?.currentBalance ?? null,
    ledgerSequence,
    accountSequence: account?.ledgerSequence ?? null,
    issues,
  };
}
