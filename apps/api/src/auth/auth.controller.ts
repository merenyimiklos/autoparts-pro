import { Body,Controller,Get,Post,Req,Res,UseGuards } from '@nestjs/common';
import { Request,Response } from 'express';
import { AuthService } from './auth.service';import { AuthUser } from './auth.types';import { LoginDto,RegisterDto,RequestResetDto,ResetPasswordDto } from './dto';import { JwtGuard } from './jwt.guard';
@Controller('auth')export class AuthController{constructor(private auth:AuthService){}private cookies(res:Response,t:{access:string;refresh:string}){const secure=process.env.COOKIE_SECURE==='true';res.cookie('access_token',t.access,{httpOnly:true,sameSite:'strict',secure,maxAge:15*60*1000,path:'/'});res.cookie('refresh_token',t.refresh,{httpOnly:true,sameSite:'strict',secure,maxAge:7*24*60*60*1000,path:'/api/auth'})}
@Post('register')register(@Body()dto:RegisterDto){return this.auth.register(dto)}
@Post('verify-email')verify(@Body()b:{token:string}){return this.auth.verifyEmail(b.token)}
@Post('login')async login(@Body()dto:LoginDto,@Req()req:Request,@Res({passthrough:true})res:Response){const t=await this.auth.login(dto);await this.auth.mergeGuestCart(t.user.id,req.cookies?.cart_session as string|undefined);res.clearCookie('cart_session');this.cookies(res,t);return {user:t.user}}
@Post('refresh')async refresh(@Req()req:Request,@Res({passthrough:true})res:Response){const t=await this.auth.refresh(req.cookies?.refresh_token as string);this.cookies(res,t);return {user:t.user}}
@Post('forgot-password')forgot(@Body()dto:RequestResetDto){return this.auth.requestReset(dto.email)}
@Post('reset-password')reset(@Body()dto:ResetPasswordDto){return this.auth.resetPassword(dto.token,dto.password)}
@Post('logout')logout(@Res({passthrough:true})res:Response){res.clearCookie('access_token');res.clearCookie('refresh_token',{path:'/api/auth'});return {ok:true}}
@Get('me')@UseGuards(JwtGuard)me(@Req()req:Request&{user:AuthUser}){return req.user}}
