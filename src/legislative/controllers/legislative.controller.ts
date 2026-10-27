import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LegislativeQueryService } from '@src/legislative/services/legislative-query.service';
import {
  AbsenceRankingQueryDto,
  ListParliamentariansQueryDto,
  ListVotingsQueryDto,
  ParliamentarianVotesQueryDto,
} from '@src/legislative/dtos/legislative-query.dto';

@ApiTags('Votações e parlamentares (público, somente leitura)')
@Controller('api')
export class LegislativeController {
  constructor(private readonly queryService: LegislativeQueryService) {}

  @Get('votings')
  @ApiOperation({ summary: 'Lista votações nominais de leis, com busca' })
  listVotings(@Query() query: ListVotingsQueryDto) {
    return this.queryService.listVotings(query);
  }

  @Get('votings/:id')
  @ApiOperation({
    summary: 'Detalhe da votação com o voto de cada parlamentar',
  })
  getVoting(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.queryService.getVoting(id);
  }

  @Get('parliamentarians')
  @ApiOperation({ summary: 'Busca deputados e senadores' })
  listParliamentarians(@Query() query: ListParliamentariansQueryDto) {
    return this.queryService.listParliamentarians(query);
  }

  @Get('parliamentarians/absences')
  @ApiOperation({
    summary: 'Ranking de votações nominais sem voto registrado no período',
  })
  absenceRanking(@Query() query: AbsenceRankingQueryDto) {
    return this.queryService.absenceRanking(query);
  }

  @Get('parliamentarians/:id')
  @ApiOperation({
    summary: 'Perfil do parlamentar com totais por tipo de voto',
  })
  getParliamentarian(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.queryService.getParliamentarian(id);
  }

  @Get('parliamentarians/:id/votes')
  @ApiOperation({ summary: 'Histórico de votos do parlamentar' })
  listVotesOfParliamentarian(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: ParliamentarianVotesQueryDto,
  ) {
    return this.queryService.listVotesOfParliamentarian(id, query);
  }
}
