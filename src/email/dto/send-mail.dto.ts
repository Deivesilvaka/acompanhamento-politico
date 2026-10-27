import { Address } from 'nodemailer/lib/mailer';
import { EmailContent } from '@src/email/templates/template-data';

export class SendEmailDto implements EmailContent {
  sender?: Address;
  recipients: Address[];
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}
