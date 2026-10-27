import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import packageJson from '../../package.json';

export const setupSwagger = (app: INestApplication) => {
  const options = new DocumentBuilder()
    .setTitle('Acompanhamento Político')
    .setDescription('API pública de votações do Congresso e newsletter')
    .setVersion(packageJson.version)
    .build();

  SwaggerModule.setup('/docs', app, SwaggerModule.createDocument(app, options));
};
