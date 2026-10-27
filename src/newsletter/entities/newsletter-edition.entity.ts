import { Column, Entity } from 'typeorm';
import { BaseEntity } from '@src/shared/database/base.entity';

/**
 * Uma edição = um conjunto de votações, renderizado UMA vez e enviado a todos.
 * O conteúdo fica salvo e é público (transparência): é exatamente o que os
 * inscritos receberam, menos o link pessoal de cancelamento. Sem PII.
 */
@Entity('newsletter_editions')
export class NewsletterEditionEntity extends BaseEntity {
  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ name: 'voting_count', type: 'integer' })
  votingCount: number;

  @Column({ name: 'subject', type: 'varchar', length: 255 })
  subject: string;

  /** HTML com marcadores no lugar dos links pessoais. Fora dos SELECTs padrão (economia). */
  @Column({ name: 'html', type: 'text', select: false })
  html: string;

  @Column({ name: 'text', type: 'text', select: false })
  text: string;

  @Column({ name: 'recipient_count', type: 'integer', default: 0 })
  recipientCount: number;

  @Column({ name: 'sent_count', type: 'integer', default: 0 })
  sentCount: number;

  @Column({ name: 'failed_count', type: 'integer', default: 0 })
  failedCount: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
