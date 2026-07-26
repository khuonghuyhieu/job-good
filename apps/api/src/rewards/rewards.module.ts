import { Module } from '@nestjs/common';

import { RewardsService } from './application/rewards.service.js';
import { RedemptionHistoryController } from './http/redemption-history.controller.js';
import { RewardsController } from './http/rewards.controller.js';
import { RedemptionIdempotencyRepository } from './infrastructure/redemption-idempotency.repository.js';
import { RewardsRepository } from './infrastructure/rewards.repository.js';

@Module({
  controllers: [RewardsController, RedemptionHistoryController],
  providers: [
    RewardsService,
    RewardsRepository,
    RedemptionIdempotencyRepository,
  ],
})
export class RewardsModule {}
