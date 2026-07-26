import { describe, expect, it } from 'vitest';

import { reconcileRewardAccount } from './reconcile-reward-account.js';

describe('Reward Point reconciliation', () => {
  it('reconciles an ordered credit and debit sequence', () => {
    expect(
      reconcileRewardAccount({ currentBalance: 20, ledgerSequence: 2 }, [
        {
          id: 'credit',
          sequence: 1,
          direction: 'credit',
          amount: 30,
          balanceAfter: 30,
        },
        {
          id: 'debit',
          sequence: 2,
          direction: 'debit',
          amount: 10,
          balanceAfter: 20,
        },
      ]),
    ).toEqual({
      reconciled: true,
      calculatedBalance: 20,
      accountBalance: 20,
      ledgerSequence: 2,
      accountSequence: 2,
      issues: [],
    });
  });

  it('reports balance-after, projection and sequence mismatches explicitly', () => {
    const result = reconcileRewardAccount(
      { currentBalance: 40, ledgerSequence: 3 },
      [
        {
          id: 'credit',
          sequence: 2,
          direction: 'credit',
          amount: 30,
          balanceAfter: 20,
        },
      ],
    );
    expect(result.reconciled).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'SEQUENCE_GAP',
      'BALANCE_AFTER_MISMATCH',
      'ACCOUNT_PROJECTION_MISMATCH',
      'ACCOUNT_SEQUENCE_MISMATCH',
    ]);
  });

  it('reports negative history and a missing account', () => {
    const result = reconcileRewardAccount(null, [
      {
        id: 'debit',
        sequence: 1,
        direction: 'debit',
        amount: 10,
        balanceAfter: 0,
      },
    ]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      'NEGATIVE_SEQUENCE',
      'BALANCE_AFTER_MISMATCH',
      'MISSING_ACCOUNT',
    ]);
  });

  it('reconciles an empty ledger with a zero-sequence account', () => {
    expect(
      reconcileRewardAccount({ currentBalance: 0, ledgerSequence: 0 }, [])
        .reconciled,
    ).toBe(true);
  });
});
