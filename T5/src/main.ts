import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3105;
  await app.listen(port);
  console.log(`ms-auth T5 (OAuth 2.0 + RBAC) running on port ${port}`);
}
bootstrap();
