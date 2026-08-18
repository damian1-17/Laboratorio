import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthHttpService } from './auth-http.service';

@Module({
  imports: [HttpModule],
  providers: [
    AuthHttpService,
    {
      provide: 'AUTH_HTTP_SERVICE',
      useExisting: AuthHttpService,
    },
  ],
  exports: ['AUTH_HTTP_SERVICE'],
})
export class AuthHttpModule {}
