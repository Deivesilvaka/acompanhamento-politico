/** Dados comuns a todos os templates. Nenhum template recebe o e-mail do destinatário. */
export interface EmailLayoutData {
  appName: string;
  unsubscribeUrl: string;
  oneClickUnsubscribeUrl: string;
}

/** Conteúdo renderizado, independente do destinatário. */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}
