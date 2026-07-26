import {
  walletLedgerResponseSchema,
  walletOverviewResponseSchema,
  type WalletLedgerResponse,
  type WalletOverviewResponse,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export const walletQueryKey = ['wallet'] as const;
export const walletOverviewQueryKey = [...walletQueryKey, 'overview'] as const;
export const walletLedgerQueryKey = [...walletQueryKey, 'ledger'] as const;

export async function getWalletOverview(): Promise<WalletOverviewResponse> {
  return walletOverviewResponseSchema.parse(
    await apiRequest('/wallet/overview'),
  );
}

export async function getWalletLedger(
  cursor: string | null,
  limit = 20,
): Promise<WalletLedgerResponse> {
  const parameters = new URLSearchParams({ limit: String(limit) });
  if (cursor) {
    parameters.set('cursor', cursor);
  }
  return walletLedgerResponseSchema.parse(
    await apiRequest(`/wallet/ledger?${parameters.toString()}`),
  );
}
