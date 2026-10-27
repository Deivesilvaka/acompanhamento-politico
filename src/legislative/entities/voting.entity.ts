import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '@src/shared/database/base.entity';
import {
  ChamberEnum,
  VotingResultEnum,
} from '@src/legislative/constants/legislative.enums';
import { VoteEntity } from '@src/legislative/entities/vote.entity';

@Entity('votings')
@Index(['chamber', 'externalId'], { unique: true })
export class VotingEntity extends BaseEntity {
  @Column({ name: 'chamber', type: 'enum', enum: ChamberEnum })
  chamber: ChamberEnum;

  @Column({ name: 'external_id', type: 'varchar', length: 50 })
  externalId: string;

  @Index()
  @Column({ name: 'date', type: 'date' })
  date: string;

  @Column({ name: 'registered_at', type: 'timestamptz', nullable: true })
  registeredAt: Date | null;

  @Column({ name: 'proposition_type', type: 'varchar', length: 10 })
  propositionType: string;

  @Column({ name: 'proposition_label', type: 'varchar', length: 40 })
  propositionLabel: string;

  @Column({ name: 'summary', type: 'text' })
  summary: string;

  @Column({ name: 'description', type: 'text' })
  description: string;

  @Column({ name: 'result', type: 'enum', enum: VotingResultEnum })
  result: VotingResultEnum;

  @Column({ name: 'is_secret', type: 'boolean', default: false })
  isSecret: boolean;

  @Column({ name: 'source_url', type: 'varchar', length: 255 })
  sourceUrl: string;

  @Column({ name: 'yes_count', type: 'integer', default: 0 })
  yesCount: number;

  @Column({ name: 'no_count', type: 'integer', default: 0 })
  noCount: number;

  @Column({ name: 'abstention_count', type: 'integer', default: 0 })
  abstentionCount: number;

  @Column({ name: 'absent_count', type: 'integer', default: 0 })
  absentCount: number;

  @Column({ name: 'justified_absence_count', type: 'integer', default: 0 })
  justifiedAbsenceCount: number;

  @Column({ name: 'other_count', type: 'integer', default: 0 })
  otherCount: number;

  @Index()
  @Column({ name: 'edition_id', type: 'uuid', nullable: true })
  editionId: string | null;

  @OneToMany(() => VoteEntity, (vote) => vote.voting)
  votes?: VoteEntity[];
}
