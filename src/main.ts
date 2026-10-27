import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from '@src/app.module';
import { setupSwagger } from '@src/config/swagger.config';
import { securityHeaders } from '@src/config/security-headers.config';
import { AllExceptionsFilter } from '@src/shared/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // CORS desabilitado: o site público é servido pela própria API (mesma origem).
    cors: false,
  });
  const config = app.get(ConfigService);
  const isProduction = config.get('NODE_ENV') === 'prd';

  app.set('trust proxy', config.get<number>('TRUST_PROXY_HOPS'));
  app.disable('x-powered-by');
  app.use(securityHeaders(isProduction));
  app.useBodyParser('json', { limit: '10kb' });
  // Necessário apenas para o "one-click unsubscribe" (RFC 8058) dos clientes de e-mail.
  app.useBodyParser('urlencoded', { limit: '1kb', extended: false });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      enableDebugMessages: !isProduction,
      disableErrorMessages: isProduction,
    }),
  );

  app.useStaticAssets(join(__dirname, '..', '..', 'public'), {
    extensions: ['html'],
    index: 'index.html',
    dotfiles: 'deny',
  });

  if (!isProduction) {
    setupSwagger(app);
  }

  app.enableShutdownHooks();

  const port = config.get<number>('APP_PORT') ?? 3000;
  await app.listen(port);
  new Logger('Bootstrap').log(`App is running on port ${port}`);
}
bootstrap();
