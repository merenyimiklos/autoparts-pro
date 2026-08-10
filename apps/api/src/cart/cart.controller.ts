import { Body, Controller, Get, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { nanoid } from 'nanoid';
import { AuthUser } from '../auth/auth.types';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { CartIdentity, CartService } from './cart.service';

@Controller('cart')
@UseGuards(OptionalJwtGuard)
export class CartController {
  constructor(private svc: CartService) {}
  private identity(req: Request & { user?: AuthUser }, res: Response): CartIdentity {
    if (req.user) return { userId: req.user.id };
    let sessionKey = req.cookies?.cart_session as string | undefined;
    if (!sessionKey) {
      sessionKey = nanoid(24);
      res.cookie('cart_session', sessionKey, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE === 'true', maxAge: 30 * 24 * 60 * 60 * 1000, path: '/' });
    }
    return { sessionKey };
  }
  @Get() get(@Req() r: Request & { user?: AuthUser }, @Res({ passthrough: true }) res: Response, @Query('shippingMethod') shipping?: string) { return this.svc.get(this.identity(r, res), shipping); }
  @Post('items') add(@Req() r: Request & { user?: AuthUser }, @Res({ passthrough: true }) res: Response, @Body() b: { productId: string; quantity: number }) { return this.svc.add(this.identity(r, res), b.productId, b.quantity); }
  @Patch('items') update(@Req() r: Request & { user?: AuthUser }, @Res({ passthrough: true }) res: Response, @Body() b: { productId: string; quantity: number }) { return this.svc.update(this.identity(r, res), b.productId, b.quantity); }
  @Post('coupon') coupon(@Req() r: Request & { user?: AuthUser }, @Res({ passthrough: true }) res: Response, @Body() b: { code: string }) { return this.svc.coupon(this.identity(r, res), b.code); }
}
