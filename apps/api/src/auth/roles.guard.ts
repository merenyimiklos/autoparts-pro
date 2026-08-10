import { CanActivate,ExecutionContext,ForbiddenException,Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { AuthUser } from './auth.types';
@Injectable() export class RolesGuard implements CanActivate { constructor(private reflector:Reflector){} canActivate(ctx:ExecutionContext){ const allowed=this.reflector.getAllAndOverride<Role[]>(ROLES_KEY,[ctx.getHandler(),ctx.getClass()]); if(!allowed?.length)return true; const req=ctx.switchToHttp().getRequest<{user?:AuthUser}>(); if(!req.user||!allowed.includes(req.user.role))throw new ForbiddenException('Nincs jogosultság ehhez a művelethez.'); return true;} }
