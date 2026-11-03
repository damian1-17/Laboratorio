import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3106;
  await app.listen(port);
  console.log(`ms-auth T6 (OAuth 2.0 + ABAC) running on port ${port}`);
}
bootstrap();

