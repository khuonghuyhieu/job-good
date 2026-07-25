import {
  colleagueSearchResponseSchema,
  coreValuesResponseSchema,
  createKudoResponseSchema,
  walletOverviewResponseSchema,
  type ColleagueSearchResponse,
  type CoreValuesResponse,
  type CreateKudoRequest,
  type CreateKudoResponse,
  type WalletOverviewResponse,
} from '@good-job/contracts';

import { apiRequest } from '../../api/client.js';

export const walletOverviewQueryKey = ['wallet', 'overview'] as const;
export const coreValuesQueryKey = ['recognition', 'core-values'] as const;
export const feedQueryKey = ['feed'] as const;

export function colleaguesQueryKey(query: string) {
  return ['recognition', 'colleagues', query] as const;
}

export async function getWalletOverview(): Promise<WalletOverviewResponse> {
  return walletOverviewResponseSchema.parse(
    await apiRequest('/wallet/overview'),
  );
}

export async function getCoreValues(): Promise<CoreValuesResponse> {
  return coreValuesResponseSchema.parse(await apiRequest('/core-values'));
}

export async function searchColleagues(
  query: string,
): Promise<ColleagueSearchResponse> {
  const parameters = new URLSearchParams();
  if (query.trim()) {
    parameters.set('query', query.trim());
  }
  const suffix = parameters.size ? `?${parameters.toString()}` : '';
  return colleagueSearchResponseSchema.parse(
    await apiRequest(`/employees${suffix}`),
  );
}

export async function createKudo(
  request: CreateKudoRequest,
  idempotencyKey: string,
): Promise<CreateKudoResponse> {
  return createKudoResponseSchema.parse(
    await apiRequest('/kudos', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(request),
    }),
  );
}
