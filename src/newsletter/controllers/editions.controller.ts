import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { EditionsArchiveService } from '@src/newsletter/services/editions-archive.service';
import { ListEditionsQueryDto } from '@src/newsletter/dtos/list-editions-query.dto';

@ApiTags('Arquivo de e-mails enviados (público)')
@Controller('api/editions')
export class EditionsController {
  constructor(private readonly archiveService: EditionsArchiveService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as edições enviadas, com filtros' })
  list(@Query() query: ListEditionsQueryDto) {
    return this.archiveService.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalhe da edição: números de envio e votações incluídas',
  })
  get(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.archiveService.get(id);
  }

  @Get(':id/email')
  @ApiOperation({ summary: 'O e-mail exatamente como foi enviado (HTML)' })
  @Header('Content-Type', 'text/html; charset=utf-8')
  // E-mail usa estilos inline; scripts continuam bloqueados (sandbox sem allow-scripts).
  @Header(
    'Content-Security-Policy',
    "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation",
  )
  getEmail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.archiveService.getEmailHtml(id);
  }
}
