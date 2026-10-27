import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@src/shared/database/base.entity';

/**
 * Observação editorial gerada por IA para uma proposta numa edição.
 * Guardada para auditoria: qual IA/modelo escreveu o quê e com quais fontes.
 */
@Entity('edition_observations')
export class EditionObservationEntity extends BaseEntity {
  @Index()
  @Column({ name: 'edition_id', type: 'uuid' })
  editionId: string;

  @Column({ name: 'chamber', type: 'varchar', length: 10 })
  chamber: string;

  @Column({ name: 'proposition_label', type: 'varchar', length: 40 })
  propositionLabel: string;

  @Column({ name: 'provider', type: 'varchar', length: 20 })
  provider: string;

  @Column({ name: 'model', type: 'varchar', length: 100 })
  model: string;

  @Column({ name: 'content', type: 'text' })
  content: string;

  @Column({ name: 'sources', type: 'jsonb', default: () => "'[]'" })
  sources: string[];
}
