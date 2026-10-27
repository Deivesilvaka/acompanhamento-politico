import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ChamberEnum } from '@src/legislative/constants/legislative.enums';
import { PaginationQueryDto } from '@src/legislative/dtos/legislative-query.dto';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ListEditionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Busca no conteúdo enviado (lei, assunto)',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ChamberEnum })
  @IsOptional()
  @IsEnum(ChamberEnum)
  chamber?: ChamberEnum;

  @ApiPropertyOptional({ example: '2026-10-01' })
  @IsOptional()
  @Matches(ISO_DATE)
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31' })
  @IsOptional()
  @Matches(ISO_DATE)
  to?: string;
}
