import { Global, Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { JobsService } from './jobs.service';
@Global()
@Module({ imports: [MailModule], providers: [JobsService], exports: [JobsService] })
export class JobsModule {}
