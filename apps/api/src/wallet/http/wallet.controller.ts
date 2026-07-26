import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  walletLedgerQuerySchema,
  type WalletLedgerResponse,
} from '@good-job/contracts';

import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal.js';
import { CurrentPrincipal } from '../../auth/current-principal.decorator.js';
import { SessionAuthGuard } from '../../auth/session-auth.guard.js';
import { ApiException } from '../../http/api.exception.js';
import { GetLedgerQuery } from '../application/get-ledger.query.js';
import { InvalidLedgerCursorError } from '../domain/ledger-cursor.js';

@Controller('wallet')
@UseGuards(SessionAuthGuard)
export class WalletController {
  constructor(
    @Inject(GetLedgerQuery)
    private readonly getLedger: GetLedgerQuery,
  ) {}

  @Get('ledger')
  async ledger(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query() rawQuery: unknown,
  ): Promise<WalletLedgerResponse> {
    const parsed = walletLedgerQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      throw new ApiException(400, {
        code: 'VALIDATION_ERROR',
        message: 'The Wallet history query is invalid.',
      });
    }
    try {
      return await this.getLedger.execute(principal, parsed.data);
    } catch (error: unknown) {
      if (error instanceof InvalidLedgerCursorError) {
        throw new ApiException(400, {
          code: 'VALIDATION_ERROR',
          message: error.message,
          fieldErrors: { cursor: 'The Wallet cursor is invalid.' },
        });
      }
      throw error;
    }
  }
}
