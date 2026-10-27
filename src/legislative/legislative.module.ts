import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParliamentarianEntity } from '@src/legislative/entities/parliamentarian.entity';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import { VoteEntity } from '@src/legislative/entities/vote.entity';
import { OfficialHttpClient } from '@src/legislative/clients/official-http.client';
import { CamaraClient } from '@src/legislative/clients/camara.client';
import { SenadoClient } from '@src/legislative/clients/senado.client';
import { LegislativeWriteRepository } from '@src/legislative/repositories/legislative-write.repository';
import { LegislativeReadRepository } from '@src/legislative/repositories/legislative-read.repository';
import { IngestionService } from '@src/legislative/services/ingestion.service';
import { LegislativeQueryService } from '@src/legislative/services/legislative-query.service';
import { LegislativeController } from '@src/legislative/controllers/legislative.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ParliamentarianEntity, VotingEntity, VoteEntity]),
  ],
  controllers: [LegislativeController],
  providers: [
    OfficialHttpClient,
    CamaraClient,
    SenadoClient,
    LegislativeWriteRepository,
    LegislativeReadRepository,
    IngestionService,
    LegislativeQueryService,
  ],
  exports: [IngestionService, LegislativeReadRepository],
})
export class LegislativeModule {}
