import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '@src/shared/database/base.entity';
import { SubscriberStatusEnum } from '@src/subscriptions/constants/subscription.constants';

/**
 * Minimização de dados (LGPD): guardamos só o e-mail e o necessário para provar
 * consentimento. Sem nome, sem IP. Cancelar = apagar a linha.
 */
@Entity('subscribers')
export class SubscriberEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ name: 'email', type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'status', type: 'enum', enum: SubscriberStatusEnum })
  status: SubscriberStatusEnum;

  @Index()
  @Column({
    name: 'confirmation_token_hash',
    type: 'char',
    length: 64,
    nullable: true,
  })
  confirmationTokenHash: string | null;

  @Column({
    name: 'confirmation_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  confirmationExpiresAt: Date | null;

  @Column({ name: 'confirmation_sent_at', type: 'timestamptz', nullable: true })
  confirmationSentAt: Date | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date | null;

  @Column({ name: 'consent_version', type: 'varchar', length: 20 })
  consentVersion: string;

  @Column({ name: 'last_edition_id', type: 'uuid', nullable: true })
  lastEditionId: string | null;

  /** Edição cuja entrega falhou por último — base para reenvio automático. */
  @Column({ name: 'failed_edition_id', type: 'uuid', nullable: true })
  failedEditionId: string | null;

  @Column({ name: 'failed_attempts', type: 'smallint', default: 0 })
  failedAttempts: number;
}
