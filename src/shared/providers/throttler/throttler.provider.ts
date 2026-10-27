import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

export const ThrottlerProvider = {
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
};
