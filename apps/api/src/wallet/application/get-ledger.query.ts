import { Inject, Injectable } from '@nestjs/common';
import type {
  WalletLedgerQuery,
  WalletLedgerResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { WalletRepository } from '../infrastructure/wallet.repository.js';

@Injectable()
export class GetLedgerQuery {
  constructor(
    @Inject(WalletRepository)
    private readonly walletRepository: WalletRepository,
  ) {}

  execute(
    principal: AuthenticatedPrincipal,
    query: WalletLedgerQuery,
  ): Promise<WalletLedgerResponse> {
    return this.walletRepository.ledger(principal, query);
  }
}
