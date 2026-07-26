import { Module } from '@nestjs/common';

import { GetLedgerQuery } from './application/get-ledger.query.js';
import { WalletController } from './http/wallet.controller.js';
import { WalletRepository } from './infrastructure/wallet.repository.js';

@Module({
  controllers: [WalletController],
  providers: [GetLedgerQuery, WalletRepository],
  exports: [WalletRepository],
})
export class WalletModule {}
