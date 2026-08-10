import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PromotionScope, PromotionType, Role } from '@prisma/client';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('promotions')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class PromotionsController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  @Get() list() { return this.prisma.promotion.findMany({ include: { coupons: true, products: true }, orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }] }); }
  @Post() async create(@Req() r: Request & { user: AuthUser }, @Body() b: { name: string; type: PromotionType; scope: PromotionScope; value: number; priority?: number; startsAt: string; endsAt?: string; automatic?: boolean; productIds?: string[]; categorySlugs?: string[]; manufacturerNames?: string[] }) {
    const promo = await this.prisma.promotion.create({ data: { name: b.name, type: b.type, scope: b.scope, value: b.value, priority: b.priority ?? 0, startsAt: new Date(b.startsAt), endsAt: b.endsAt ? new Date(b.endsAt) : undefined, automatic: b.automatic ?? true, categorySlugs: b.categorySlugs ?? [], manufacturerNames: b.manufacturerNames ?? [], products: b.productIds?.length ? { create: b.productIds.map((productId) => ({ productId })) } : undefined } });
    await this.audit.write({ actorId: r.user.id, action: 'PROMOTION_CREATED', entityType: 'Promotion', entityId: promo.id, after: { name: promo.name, type: promo.type, value: Number(promo.value) } });
    return promo;
  }
  @Patch(':id') async update(@Req() r: Request & { user: AuthUser }, @Param('id') id: string, @Body() b: { active?: boolean; automatic?: boolean; priority?: number; endsAt?: string; categorySlugs?: string[]; manufacturerNames?: string[] }) {
    const before = await this.prisma.promotion.findUniqueOrThrow({ where: { id } });
    const promo = await this.prisma.promotion.update({ where: { id }, data: { active: b.active, automatic: b.automatic, priority: b.priority, endsAt: b.endsAt ? new Date(b.endsAt) : undefined, categorySlugs: b.categorySlugs, manufacturerNames: b.manufacturerNames } });
    await this.audit.write({ actorId: r.user.id, action: 'PROMOTION_UPDATED', entityType: 'Promotion', entityId: id, before: { active: before.active, priority: before.priority }, after: { active: promo.active, priority: promo.priority } });
    return promo;
  }
  @Post(':id/coupons') async coupon(@Req() r: Request & { user: AuthUser }, @Param('id') id: string, @Body() b: { code: string; minCartGross?: number; globalLimit?: number; perUserLimit?: number }) {
    await this.prisma.promotion.update({ where: { id }, data: { automatic: false } });
    const coupon = await this.prisma.coupon.create({ data: { promotionId: id, code: b.code.toUpperCase(), minCartGross: b.minCartGross, globalLimit: b.globalLimit, perUserLimit: b.perUserLimit } });
    await this.audit.write({ actorId: r.user.id, action: 'COUPON_CREATED', entityType: 'Coupon', entityId: coupon.id, after: { code: coupon.code } });
    return coupon;
  }
}
