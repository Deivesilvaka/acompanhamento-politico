import { EmailTemplateEnum } from '@src/email/enums/email-templates.enum';
import { SubscriptionConfirmationTemplate } from '@src/email/templates/subscription-confirmation.template';
import { WelcomeTemplate } from '@src/email/templates/welcome.template';
import { DailyDigestTemplate } from '@src/email/templates/daily-digest.template';

const templates = {
  [EmailTemplateEnum.SUBSCRIPTION_CONFIRMATION]:
    SubscriptionConfirmationTemplate,
  [EmailTemplateEnum.WELCOME]: WelcomeTemplate,
  [EmailTemplateEnum.DAILY_DIGEST]: DailyDigestTemplate,
};

export type EmailTemplates = typeof templates;
export type EmailTemplateData<T extends EmailTemplateEnum> = Parameters<
  EmailTemplates[T]
>[0];

export default templates;
