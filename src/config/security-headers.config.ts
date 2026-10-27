import helmet from 'helmet';
import { ALLOWED_PHOTO_HOSTS } from '@src/legislative/constants/official-sources';

/**
 * CSP restritiva: só scripts/estilos servidos pela própria API (nada inline),
 * fotos apenas dos portais oficiais da Câmara e do Senado.
 */
export const securityHeaders = (isProduction: boolean) =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: [
          "'self'",
          'data:',
          ...ALLOWED_PHOTO_HOSTS.map((h) => `https://${h}`),
        ],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProduction ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  });
