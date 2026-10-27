import { Module } from '@nestjs/common';
import { EmailService } from '@src/email/services/email.service';

@Module({
  imports: [],
  exports: [EmailService],
  providers: [EmailService],
})
export class EmailModule {}
