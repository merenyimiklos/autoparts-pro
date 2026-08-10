import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from './auth.types';

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = req.cookies?.access_token as string | undefined;
    if (!token) return true;
    try {
      req.user = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-change-me',
      });
    } catch {
      // An expired/invalid auth cookie behaves like a guest on optional routes.
    }
    return true;
  }
}
