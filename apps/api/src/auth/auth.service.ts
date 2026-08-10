import { ConflictException,HttpException,HttpStatus,Injectable,UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import argon2 from 'argon2';
import { createHash,randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { MailService } from '../mail/mail.service';
import { LoginDto,RegisterDto } from './dto';
@Injectable()export class AuthService{
 constructor(private prisma:PrismaService,private jwt:JwtService,private mail:MailService,private cache:CacheService){}
 private async throttle(key:string){const n=await this.cache.hit(`auth:login:${key}`,60);if(n>5)throw new HttpException('Túl sok sikertelen próbálkozás. Próbáld később.',HttpStatus.TOO_MANY_REQUESTS)}
 private hashToken(t:string){return createHash('sha256').update(t).digest('hex')}
 private async createToken(userId:string,type:'verify'|'reset',minutes:number){const token=randomBytes(32).toString('hex');await this.prisma.authToken.create({data:{userId,type,tokenHash:this.hashToken(token),expiresAt:new Date(Date.now()+minutes*60_000)}});return token}
 async register(dto:RegisterDto){const email=dto.email.toLowerCase();if(await this.prisma.user.findUnique({where:{email}}))throw new ConflictException('Az e-mail már foglalt.');const user=await this.prisma.user.create({data:{email,passwordHash:await argon2.hash(dto.password),firstName:dto.firstName,lastName:dto.lastName}});const token=await this.createToken(user.id,'verify',60*24);await this.mail.sendVerification(email,token);return {requiresVerification:true,email};}
 async verifyEmail(token:string){const row=await this.prisma.authToken.findUnique({where:{tokenHash:this.hashToken(token)}});if(!row||row.type!=='verify'||row.usedAt||row.expiresAt<new Date())throw new UnauthorizedException('Érvénytelen vagy lejárt token.');await this.prisma.$transaction([this.prisma.authToken.update({where:{id:row.id},data:{usedAt:new Date()}}),this.prisma.user.update({where:{id:row.userId},data:{emailVerifiedAt:new Date()}})]);return {ok:true}}
 async login(dto:LoginDto){const email=dto.email.toLowerCase();await this.throttle(email);const user=await this.prisma.user.findUnique({where:{email}});if(!user||!await argon2.verify(user.passwordHash,dto.password))throw new UnauthorizedException('Hibás belépési adatok.');if(!user.emailVerifiedAt)throw new UnauthorizedException('Előbb erősítsd meg az e-mail-címed.');return this.issue(user.id,user.email,user.role)}
 async refresh(refresh:string){let payload:{id:string;email:string;role:Role};try{payload=await this.jwt.verifyAsync(refresh,{secret:process.env.JWT_REFRESH_SECRET??'dev-refresh-change-me'})}catch{throw new UnauthorizedException()}const user=await this.prisma.user.findUnique({where:{id:payload.id}});if(!user?.refreshTokenHash||!await argon2.verify(user.refreshTokenHash,refresh))throw new UnauthorizedException();return this.issue(user.id,user.email,user.role)}
 async requestReset(email:string){const user=await this.prisma.user.findUnique({where:{email:email.toLowerCase()}});if(user){const token=await this.createToken(user.id,'reset',30);await this.mail.sendPasswordReset(user.email,token)}return {ok:true}}
 async resetPassword(token:string,password:string){const row=await this.prisma.authToken.findUnique({where:{tokenHash:this.hashToken(token)}});if(!row||row.type!=='reset'||row.usedAt||row.expiresAt<new Date())throw new UnauthorizedException('Érvénytelen vagy lejárt token.');await this.prisma.$transaction([this.prisma.authToken.update({where:{id:row.id},data:{usedAt:new Date()}}),this.prisma.user.update({where:{id:row.userId},data:{passwordHash:await argon2.hash(password),refreshTokenHash:null}})]);return {ok:true}}
 private async issue(id:string,email:string,role:Role){const payload={id,email,role};const access=await this.jwt.signAsync(payload,{secret:process.env.JWT_ACCESS_SECRET??'dev-access-change-me',expiresIn:'15m'});const refresh=await this.jwt.signAsync(payload,{secret:process.env.JWT_REFRESH_SECRET??'dev-refresh-change-me',expiresIn:'7d'});await this.prisma.user.update({where:{id},data:{refreshTokenHash:await argon2.hash(refresh)}});return {access,refresh,user:payload}}
}
