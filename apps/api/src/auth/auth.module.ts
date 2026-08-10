import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { OptionalJwtGuard } from './optional-jwt.guard';
@Module({imports:[JwtModule.register({})],controllers:[AuthController],providers:[AuthService,JwtGuard,OptionalJwtGuard,RolesGuard],exports:[JwtModule,JwtGuard,OptionalJwtGuard,RolesGuard]}) export class AuthModule {}
