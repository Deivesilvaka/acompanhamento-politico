import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '@src/shared/database/base.entity';
import { VoteTypeEnum } from '@src/legislative/constants/legislative.enums';
import { VotingEntity } from '@src/legislative/entities/voting.entity';
import { ParliamentarianEntity } from '@src/legislative/entities/parliamentarian.entity';

@Entity('votes')
@Index(['votingId', 'parliamentarianId'], { unique: true })
@Index(['parliamentarianId', 'type'])
export class VoteEntity extends BaseEntity {
  @Column({ name: 'voting_id', type: 'uuid' })
  votingId: string;

  @Column({ name: 'parliamentarian_id', type: 'uuid' })
  parliamentarianId: string;

  @Column({ name: 'type', type: 'enum', enum: VoteTypeEnum })
  type: VoteTypeEnum;

  /** Texto exatamente como veio da fonte oficial (ex.: "Sim", "MIS", "NCom"). */
  @Column({ name: 'raw_value', type: 'varchar', length: 60, nullable: true })
  rawValue: string | null;

  @Column({
    name: 'party_at_vote',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  partyAtVote: string | null;

  @Column({ name: 'state_at_vote', type: 'char', length: 2, nullable: true })
  stateAtVote: string | null;

  @ManyToOne(() => VotingEntity, (voting) => voting.votes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'voting_id' })
  voting?: VotingEntity;

  @ManyToOne(() => ParliamentarianEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parliamentarian_id' })
  parliamentarian?: ParliamentarianEntity;
}
