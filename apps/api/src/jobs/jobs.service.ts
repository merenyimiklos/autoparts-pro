import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';

type MailJob =
  | { type: 'verification'; to: string; token: string; attempts?: number }
  | { type: 'password-reset'; to: string; token: string; attempts?: number }
  | { type: 'order'; to: string; orderNumber: string; total: number; attempts?: number }
  | { type: 'status'; to: string; orderNumber: string; status: string; attempts?: number }
  | { type: 'message'; to: string; subject: string; html: string; attempts?: number };

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly queue = 'jobs:mail';
  private timer?: NodeJS.Timeout;
  private draining = false;
  constructor(private cache: CacheService, private mail: MailService) {}
  onModuleInit() { this.timer = setInterval(() => void this.drain(), 500); void this.drain(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  verification(to: string, token: string) { return this.cache.queuePush(this.queue, { type: 'verification', to, token } satisfies MailJob); }
  passwordReset(to: string, token: string) { return this.cache.queuePush(this.queue, { type: 'password-reset', to, token } satisfies MailJob); }
  order(to: string, orderNumber: string, total: number) { return this.cache.queuePush(this.queue, { type: 'order', to, orderNumber, total } satisfies MailJob); }
  status(to: string, orderNumber: string, status: string) { return this.cache.queuePush(this.queue, { type: 'status', to, orderNumber, status } satisfies MailJob); }
  message(to: string, subject: string, html: string) { return this.cache.queuePush(this.queue, { type: 'message', to, subject, html } satisfies MailJob); }
  private async drain() {
    if (this.draining) return;
    this.draining = true;
    try {
      for (let i = 0; i < 20; i++) {
        const job = await this.cache.queuePop<MailJob>(this.queue);
        if (!job) break;
        try {
          if (job.type === 'verification') await this.mail.sendVerification(job.to, job.token);
          else if (job.type === 'password-reset') await this.mail.sendPasswordReset(job.to, job.token);
          else if (job.type === 'order') await this.mail.sendOrder(job.to, job.orderNumber, job.total);
          else if (job.type === 'status') await this.mail.sendStatus(job.to, job.orderNumber, job.status);
          else await this.mail.send(job.to, job.subject, job.html);
        } catch (error) {
          const attempts = (job.attempts ?? 0) + 1;
          if (attempts < 3) await this.cache.queuePush(this.queue, { ...job, attempts });
          else console.error('Mail job failed permanently', { type: job.type, to: job.to, error });
        }
      }
    } finally { this.draining = false; }
  }
}
