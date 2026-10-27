import { Module } from '@nestjs/common';
import { ObservationService } from '@src/ai/services/observation.service';

@Module({
  providers: [ObservationService],
  exports: [ObservationService],
})
export class AiModule {}
