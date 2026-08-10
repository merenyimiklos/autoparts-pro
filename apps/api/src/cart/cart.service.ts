import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';

export type CartIdentity = { userId?: string; sessionKey?: string };

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService, private pricing: PricingService) {}
  cartId(identity: CartIdentity) {
    if (identity.userId) return `user-${identity.userId}`;
    if (identity.sessionKey) return `guest-${identity.sessionKey}`;
    throw new BadRequestException('Hiányzó kosár-azonosító.');
  }
  private async cart(identity: CartIdentity) {
    const id = this.cartId(identity);
    return this.prisma.cart.upsert({
      where: { id },
      update: {},
      create: { id, userId: identity.userId, sessionKey: identity.userId ? undefined : identity.sessionKey },
      include: { items: { include: { product: { include: { manufacturer: true, images: true } } } } },
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
    return { ...cart, ...q };
  }
  async add(identity: CartIdentity, productId: string, quantity: number) {
    if (quantity < 1 || quantity > 99) throw new BadRequestException();
    const p = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!p) throw new NotFoundException();
    const cart = await this.cart(identity);
    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      update: { quantity: { increment: quantity } },
      create: { cartId: cart.id, productId, quantity },
    });
    return this.get(identity);
  }
  async update(identity: CartIdentity, productId: string, quantity: number) {
    const cart = await this.cart(identity);
    if (quantity <= 0) await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    else await this.prisma.cartItem.update({ where: { cartId_productId: { cartId: cart.id, productId } }, data: { quantity } });
    return this.get(identity);
  }
  async coupon(identity: CartIdentity, code: string) {
    const cart = await this.cart(identity);
    await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: code.trim().toUpperCase() } });
    try { return await this.get(identity); }
    catch (e) { await this.prisma.cart.update({ where: { id: cart.id }, data: { couponCode: null } }); throw e; }
  }
}
