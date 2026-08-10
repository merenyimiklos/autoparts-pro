import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
@Injectable() export class AuditService {
  constructor(private readonly prisma:PrismaService){}
  write(data:{actorId?:string;action:string;entityType:string;entityId?:string;before?:unknown;after?:unknown;ip?:string},tx?:Prisma.TransactionClient){const db=tx??this.prisma;return db.auditLog.create({data:{actorId:data.actorId,action:data.action,entityType:data.entityType,entityId:data.entityId,before:data.before as Prisma.InputJsonValue|undefined,after:data.after as Prisma.InputJsonValue|undefined,ip:data.ip}})}
}
