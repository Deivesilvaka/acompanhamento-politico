import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ChamberEnum,
  VoteTypeEnum,
} from '@src/legislative/constants/legislative.enums';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class ListVotingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por número da lei ou assunto' })
  @IsOptional()
  @Transform(trim)
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

export class ListParliamentariansQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Busca por nome' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ChamberEnum })
  @IsOptional()
  @IsEnum(ChamberEnum)
  chamber?: ChamberEnum;

  @ApiPropertyOptional({ example: 'PT' })
  @IsOptional()
  @Matches(/^[\p{L}\d ]{1,30}$/u)
  party?: string;

  @ApiPropertyOptional({ example: 'SP' })
  @IsOptional()
  @Matches(/^[A-Z]{2}$/)
  state?: string;
}

export class ParliamentarianVotesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: VoteTypeEnum })
  @IsOptional()
  @IsEnum(VoteTypeEnum)
  type?: VoteTypeEnum;
}

export class AbsenceRankingQueryDto {
  @ApiPropertyOptional({ enum: ChamberEnum })
  @IsOptional()
  @IsEnum(ChamberEnum)
  chamber?: ChamberEnum;

  @ApiPropertyOptional({ description: 'Padrão: 30 dias atrás' })
  @IsOptional()
  @Matches(ISO_DATE)
  from?: string;

  @ApiPropertyOptional({ description: 'Padrão: hoje' })
  @IsOptional()
  @Matches(ISO_DATE)
  to?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
