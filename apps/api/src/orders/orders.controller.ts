import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { JwtGuard } from '../auth/jwt.guard';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CheckoutDto } from './dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private svc: OrdersService) {}
  @Post('checkout')
  @UseGuards(OptionalJwtGuard)
  checkout(@Req() r: Request & { user?: AuthUser }, @Body() b: CheckoutDto) {
    return this.svc.checkout({ userId: r.user?.id, sessionKey: r.cookies?.cart_session as string | undefined }, b);
  }
  @Get('track/:number')
  track(@Param('number') number: string, @Query('email') email: string) { return this.svc.track(number, email); }
  @Get('mine') @UseGuards(JwtGuard)
  mine(@Req() r: Request & { user: AuthUser }) { return this.svc.mine(r.user.id); }
  @Get('admin') @UseGuards(JwtGuard, RolesGuard) @Roles(Role.SUPPORT, Role.ADMIN, Role.SUPERADMIN, Role.WAREHOUSE)
  admin() { return this.svc.adminList(); }
  @Patch(':id/status') @UseGuards(JwtGuard, RolesGuard) @Roles(Role.WAREHOUSE, Role.SUPPORT, Role.ADMIN, Role.SUPERADMIN)
  status(@Param('id') id: string, @Req() r: Request & { user: AuthUser }, @Body() b: { status: OrderStatus; customerNote?: string; internalNote?: string }) {
    return this.svc.transition(id, b.status, r.user, { customer: b.customerNote, internal: b.internalNote });
  }
}
