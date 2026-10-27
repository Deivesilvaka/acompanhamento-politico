import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { name } from '../package.json';

@ApiTags('App')
@Controller()
export class AppController {
  @Get('/health')
  @SkipThrottle()
  @ApiOperation({ summary: 'Healthcheck.' })
  healthCheck(): string {
    return `Service ${name} is up and running`;
  }
}
