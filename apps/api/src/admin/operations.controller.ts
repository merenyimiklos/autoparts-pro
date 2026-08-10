import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ReturnStatus, Role } from '@prisma/client';
import { Request } from 'express';
import { AuthUser } from '../auth/auth.types';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Controller('admin/operations')
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class OperationsController {
  constructor(private prisma: PrismaService, private audit: AuditService) {}
  @Get('users') users(@Query('q') q?: string) { return this.prisma.user.findMany({ where: q ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }] } : {}, take: 100, select: { id: true, email: true, firstName: true, lastName: true, role: true, customerGroup: true, emailVerifiedAt: true, createdAt: true } }); }
  @Patch('users/:id/role') @Roles(Role.SUPERADMIN) async role(@Req() r: Request & { user: AuthUser }, @Param('id') id: string, @Body() b: { role: Role }) { const before = await this.prisma.user.findUniqueOrThrow({ where: { id } }); const u = await this.prisma.user.update({ where: { id }, data: { role: b.role } }); await this.audit.write({ actorId: r.user.id, action: 'USER_ROLE_CHANGED', entityType: 'User', entityId: id, before: { role: before.role }, after: { role: u.role } }); return { ok: true }; }
  @Patch('users/:id/customer-group') async customerGroup(@Req() r: Request & { user: AuthUser }, @Param('id') id: string, @Body() b: { customerGroupId?: string | null }) { const u = await this.prisma.user.update({ where: { id }, data: { customerGroupId: b.customerGroupId ?? null } }); await this.audit.write({ actorId: r.user.id, action: 'CUSTOMER_GROUP_ASSIGNED', entityType: 'User', entityId: id, after: { customerGroupId: u.customerGroupId } }); return { ok: true }; }
  @Get('customer-groups') groups() { return this.prisma.customerGroup.findMany({ orderBy: { name: 'asc' } }); }
  @Post('customer-groups') async createGroup(@Req() r: Request & { user: AuthUser }, @Body() b: { name: string; priceMultiplier: number }) { const group = await this.prisma.customerGroup.create({ data: { name: b.name, priceMultiplier: b.priceMultiplier } }); await this.audit.write({ actorId: r.user.id, action: 'CUSTOMER_GROUP_CREATED', entityType: 'CustomerGroup', entityId: group.id, after: { name: group.name, priceMultiplier: Number(group.priceMultiplier) } }); return group; }
  @Patch('customer-groups/:id') async updateGroup(@Req() r: Request & { user: AuthUser }, @Param('id') id: string, @Body() b: { name?: string; priceMultiplier?: number }) { const before = await this.prisma.customerGroup.findUniqueOrThrow({ where: { id } }); const group = await this.prisma.customerGroup.update({ where: { id }, data: b }); await this.audit.write({ actorId: r.user.id, action: 'CUSTOMER_GROUP_UPDATED', entityType: 'CustomerGroup', entityId: id, before: { name: before.name, priceMultiplier: Number(before.priceMultiplier) }, after: { name: group.name, priceMultiplier: Number(group.priceMultiplier) } }); return group; }
  @Get('warehouses') warehouses() { return this.prisma.warehouse.findMany({ orderBy: { code: 'asc' } }); }
  @Post('warehouses') @Roles(Role.SUPERADMIN) async warehouse(@Req() r: Request & { user: AuthUser }, @Body() b: { code: string; name: string; address: string; active?: boolean }) { const w = await this.prisma.warehouse.create({ data: { ...b, active: b.active ?? true } }); await this.audit.write({ actorId: r.user.id, action: 'WAREHOUSE_CREATED', entityType: 'Warehouse', entityId: w.id, after: w }); return w; }
  @Patch('warehouses/:id') @Roles(Role.SUPERADMIN) async updateWarehouse(@Req() r: Request & { user: AuthUser }, @Param('id') id: string, @Body() b: { name?: string; address?: string; active?: boolean }) { const w = await this.prisma.warehouse.update({ where: { id }, data: b }); await this.audit.write({ actorId: r.user.id, action: 'WAREHOUSE_UPDATED', entityType: 'Warehouse', entityId: id, after: w }); return w; }
  @Get('settings') @Roles(Role.SUPERADMIN) settings() { return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } }); }
  @Patch('settings/:key') @Roles(Role.SUPERADMIN) async setting(@Req() r: Request & { user: AuthUser }, @Param('key') key: string, @Body() b: { value: unknown }) { const row = await this.prisma.systemSetting.upsert({ where: { key }, update: { value: b.value as never }, create: { key, value: b.value as never } }); await this.audit.write({ actorId: r.user.id, action: 'SETTING_UPDATED', entityType: 'SystemSetting', entityId: key, after: { value: b.value } }); return row; }
  @Get('reviews') reviews() { return this.prisma.review.findMany({ take: 100, include: { user: { select: { email: true } }, product: { select: { name: true, sku: true } } }, orderBy: { createdAt: 'desc' } }); }
  @Patch('reviews/:id') review(@Param('id') id: string, @Body() b: { approved: boolean }) { return this.prisma.review.update({ where: { id }, data: { approved: b.approved } }); }
  @Get('returns') returns() { return this.prisma.returnRequest.findMany({ take: 100, include: { order: true, user: { select: { email: true } } }, orderBy: { createdAt: 'desc' } }); }
  @Patch('returns/:id') returnStatus(@Param('id') id: string, @Body() b: { status: ReturnStatus; note?: string }) { return this.prisma.returnRequest.update({ where: { id }, data: { status: b.status, note: b.note } }); }
  @Get('audit') @Roles(Role.SUPERADMIN) auditLog() { return this.prisma.auditLog.findMany({ take: 200, include: { actor: { select: { email: true } } }, orderBy: { createdAt: 'desc' } }); }
}
