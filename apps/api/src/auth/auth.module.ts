import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
@Module({imports:[JwtModule.register({})],controllers:[AuthController],providers:[AuthService,JwtGuard,RolesGuard],exports:[JwtModule,JwtGuard,RolesGuard]}) export class AuthModule {}
