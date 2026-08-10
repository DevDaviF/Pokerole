import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import dataLib from './lib/data.lib';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const host = dataLib.getDefault(
    process.env.API_HOST,
    'http://localhost:3001',
  );
  const port = getPort(host);

  app.enableCors({
    origin: dataLib.required(process.env.APP_HOST, 'APP_HOST is not set'),
    credentials: true,
  });

  app.setGlobalPrefix('api');

  console.log(`Server is listening on host ${host}`);
  await app.listen(port);
}

function getPort(host: string): number {
  if (host.includes(':')) {
    return Number(host.split(':')[1]);
  } else if (host.startsWith('https://')) {
    return 443;
  } else {
    return 80;
  }
}

void bootstrap();
