import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@src/shared/database/base.entity';
import { ChamberEnum } from '@src/legislative/constants/legislative.enums';

@Entity('parliamentarians')
@Index(['chamber', 'externalId'], { unique: true })
export class ParliamentarianEntity extends BaseEntity {
  @Column({ name: 'chamber', type: 'enum', enum: ChamberEnum })
  chamber: ChamberEnum;

  @Column({ name: 'external_id', type: 'integer' })
  externalId: number;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'party', type: 'varchar', length: 30, nullable: true })
  party: string | null;

  @Column({ name: 'state', type: 'char', length: 2, nullable: true })
  state: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 255, nullable: true })
  photoUrl: string | null;
}
