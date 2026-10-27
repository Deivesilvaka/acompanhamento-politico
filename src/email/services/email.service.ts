import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, SendMailOptions, Transporter } from 'nodemailer';
import { SendEmailDto } from '@src/email/dto/send-mail.dto';
import templates, { EmailTemplateData } from '@src/email/templates/index';
import { EmailTemplateEnum } from '@src/email/enums/email-templates.enum';
import { EmailContent } from '@src/email/templates/template-data';
import {
  classifySmtpError,
  EmailDeliveryError,
} from '@src/email/errors/email-delivery.error';

/** Envios simultâneos — igual ao número de conexões do pool SMTP. */
export const EMAIL_SEND_CONCURRENCY = 5;

@Injectable()
export class EmailService implements OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private readonly mailTransport: Transporter;

  constructor(private configService: ConfigService) {
    const secure = this.configService.get<boolean>('MAIL_SECURE') ?? false;
    this.mailTransport = createTransport({
      host: this.configService.get('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure,
      // Sem TLS implícito, exige STARTTLS: credenciais e conteúdo nunca trafegam em claro.
      requireTLS: !secure,
      tls: {
        minVersion: 'TLSv1.2',
        // Só o Mailpit local usa certificado autoassinado; produção é bloqueada na validação do env.
        rejectUnauthorized: !this.configService.get<boolean>(
          'MAIL_ALLOW_SELF_SIGNED',
        ),
      },
      // Pool reaproveita conexões SMTP; rateLimit respeita o limite do provedor (plano gratuito).
      pool: true,
      maxConnections: EMAIL_SEND_CONCURRENCY,
      rateDelta: 1000,
      rateLimit: this.configService.get<number>('MAIL_MAX_PER_SECOND') ?? 10,
      auth: {
        user: this.configService.get('MAIL_USER'),
        pass: this.configService.get('MAIL_PASSWORD'),
      },
    });
  }

  /** Fecha as conexões do pool SMTP (shutdown gracioso e fim dos scripts). */
  onModuleDestroy() {
    this.mailTransport.close();
  }

  async sendEmail(data: SendEmailDto): Promise<{ success: boolean }> {
    const { sender, recipients, subject, html, text, headers } = data;

    const mailOptions: SendMailOptions = {
      from: sender ?? {
        name: this.configService.get('MAIL_SENDER_NAME_DEFAULT') ?? '',
        address: this.configService.get('MAIL_SENDER_DEFAULT') ?? '',
      },
      to: recipients,
      subject,
      html,
      text,
      headers,
    };

    try {
      await this.mailTransport.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      const smtpError = error as {
        code?: string;
        command?: string;
        responseCode?: number;
      };
      const kind = classifySmtpError(smtpError);
      // Não loga destinatário (PII) nem o erro bruto, que pode ecoar o endereço.
      this.logger.error(
        `Falha ao enviar e-mail (${kind}): ${smtpError.code ?? 'erro desconhecido'} ${smtpError.command ?? ''} ${smtpError.responseCode ?? ''}`,
      );
      throw new EmailDeliveryError(kind);
    }
  }

  async sendTemplate<T extends EmailTemplateEnum>(
    template: T,
    to: string,
    data: EmailTemplateData<T>,
  ) {
    const render = templates[template] as (
      input: EmailTemplateData<T>,
    ) => EmailContent;
    await this.sendContent(to, render(data));
  }

  /** Envia conteúdo já renderizado (ex.: resumo diário renderizado uma vez por edição). */
  async sendContent(to: string, content: EmailContent) {
    await this.sendEmail({
      ...content,
      recipients: [{ name: '', address: to }],
    });
  }
}
