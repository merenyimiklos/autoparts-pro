import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

export type CartIdentity = { userId?: string; sessionKey?: string };

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService, private pricing: PricingService) {}
  cartId(identity: CartIdentity) {
    if (identity.userId) return `user-${identity.userId}`;
    if (identity.sessionKey) return `guest-${identity.sessionKey}`;
    throw new BadRequestException('A kosár munkamenete nem található. Frissítsd az oldalt és próbáld újra.');
  }
  private async cart(identity: CartIdentity) {
    const id = this.cartId(identity);
    return this.prisma.cart.upsert({
      where: { id },
      update: {},
      create: { id, userId: identity.userId, sessionKey: identity.userId ? undefined : identity.sessionKey },
      include: { items: { include: { product: { include: { manufacturer: true, images: { orderBy: { sortOrder: 'asc' } } } } }, orderBy: { id: 'asc' } } },
    });
  }
  async get(identity: CartIdentity, shippingMethod = 'home') {
    const cart = await this.cart(identity);
    const q = await this.pricing.quote(
      cart.items.map((i) => ({ productId: i.productId, quantity: i.quantity, grossPrice: Number(i.product.grossPrice) })),
      cart.couponCode ?? undefined,
      identity.userId,
      shippingMethod,
    );
    const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    return { ...cart, ...q, itemCount, isEmpty: itemCount === 0 };
  }
  async add(identity: CartIdentity, productId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new BadRequestException('A mennyiség 1 és 99 közötti egész szám lehet.');
    const p = await this.prisma.product.findUnique({ where: { id: productId }, include: { inventory: true } });
    if (!p || p.status !== ProductStatus.ACTIVE) throw new NotFoundException('A termék nem található vagy jelenleg nem rendelhető.');
    const available = p.inventory.reduce((sum, row) => sum + Math.max(0, row.physical - row.reserved - row.damaged), 0);
    const cart = await this.cart(identity);
    const existing = cart.items.find((item) => item.productId === productId)?.quantity ?? 0;
    if (existing + quantity > available) throw new BadRequestException(`Ebből a termékből jelenleg legfeljebb ${available} db rendelhető.`);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: quantity } },
      create: { cartId: cart.id, productId, quantity },
    });
    return this.get(identity);
  }
  async update(identity: CartIdentity, productId: string, quantity: number) {
    if (!Number.isInteger(quantity)) throw new BadRequestException('Érvénytelen mennyiség.');
    const cart = await this.cart(identity);
    if (quantity <= 0) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
      return this.get(identity);
    }
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { inventory: true } });
    if (!product) throw new NotFoundException('A termék nem található.');
    const available = product.inventory.reduce((sum, row) => sum + Math.max(0, row.physical - row.reserved - row.damaged), 0);
    if (quantity > available) throw new BadRequestException(`Ebből a termékből jelenleg legfeljebb ${available} db rendelhető.`);
    const changed = await this.prisma.cartItem.updateMany({ where: { cartId: cart.id, productId }, data: { quantity } });
    if (!changed.count) throw new NotFoundException('Ez a termék már nincs a kosaradban.');
    return this.get(identity);
  }
  async coupon(identity: CartIdentity, code: string) {
    const cart = await this.cart(identity);
    if (!cart.items.length) throw new BadRequestException('Üres kosárhoz nem használható kupon.');
    const normalized = code.trim().toUpperCase();
    if (!normalized) throw new BadRequestException('Adj meg egy kuponkódot.');
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: normalized } });
    try { return await this.get(identity); }
    catch (e) { await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } }); throw e; }
  }
}
