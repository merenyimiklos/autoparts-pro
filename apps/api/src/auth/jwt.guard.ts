import { CanActivate,ExecutionContext,Injectable,UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from './auth.types';
@Injectable() export class JwtGuard implements CanActivate {
  constructor(private readonly jwt:JwtService){}
  async canActivate(ctx:ExecutionContext){ const req=ctx.switchToHttp().getRequest<Request & {user?:AuthUser}>(); const token=req.cookies?.access_token as string|undefined; if(!token) throw new UnauthorizedException(); try{req.user=await this.jwt.verifyAsync<AuthUser>(token,{secret:process.env.JWT_ACCESS_SECRET??'dev-access-change-me'});return true;}catch{throw new UnauthorizedException();}}
}
