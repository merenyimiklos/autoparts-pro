import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PromotionScope, PromotionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type PriceLine = { productId: string; quantity: number; grossPrice: number };
export type PriceLineQuote = PriceLine & { unitGross: number; baseGross: number; discountGross: number; finalGross: number; promotion?: string };

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(lines: PriceLine[], couponCode: string | undefined, userId: string | undefined, shippingMethod: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;
    const now = new Date();
    const productIds = [...new Set(lines.map((l) => l.productId))];
    const [products, automaticPromotions, user] = await Promise.all([
      db.product.findMany({ where: { id: { in: productIds } }, include: { manufacturer: true, categories: true } }),
      db.promotion.findMany({
        where: { active: true, automatic: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        include: { products: true }, orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
      }),
      userId ? db.user.findUnique({ where: { id: userId }, select: { customerGroup: { select: { priceMultiplier: true } } } }) : Promise.resolve(null),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));
    const groupMultiplier = user?.customerGroup ? Number(user.customerGroup.priceMultiplier) : 1;
    let autoFreeShipping = false;
    const lineQuotes: PriceLineQuote[] = lines.map((line) => {
      const product = productMap.get(line.productId);
      const unitGross = Math.max(0, Math.round(line.grossPrice * groupMultiplier));
      const baseGross = unitGross * line.quantity;
      if (!product) return { ...line, unitGross, baseGross, discountGross: 0, finalGross: baseGross };
      const matching = automaticPromotions.find((promo) => {
        if (promo.scope === PromotionScope.CART) return true;
        if (promo.scope === PromotionScope.PRODUCT) return promo.products.some((x) => x.productId === product.id);
        if (promo.scope === PromotionScope.CATEGORY) return product.categories.some((c) => promo.categorySlugs.includes(c.slug));
        if (promo.scope === PromotionScope.MANUFACTURER) return promo.manufacturerNames.includes(product.manufacturer.name);
        return false;
      });
      if (!matching) return { ...line, unitGross, baseGross, discountGross: 0, finalGross: baseGross };
      if (matching.type === PromotionType.FREE_SHIPPING) { autoFreeShipping = true; return { ...line, unitGross, baseGross, discountGross: 0, finalGross: baseGross, promotion: matching.name }; }
      const value = Number(matching.value);
      const discountGross = matching.type === PromotionType.PERCENT ? Math.min(baseGross, Math.round(baseGross * value / 100)) : Math.min(baseGross, value);
      return { ...line, unitGross, baseGross, discountGross, finalGross: baseGross - discountGross, promotion: matching.name };
    });

    const subtotal = lineQuotes.reduce((s, l) => s + l.baseGross, 0);
    const automaticDiscount = lineQuotes.reduce((s, l) => s + l.discountGross, 0);
    const discountedSubtotal = subtotal - automaticDiscount;
    const baseShipping = shippingMethod === 'pickup' ? 0 : shippingMethod === 'parcel' ? 1490 : 1990;
    let shipping = autoFreeShipping ? 0 : baseShipping;
    let couponDiscount = 0;
    let couponId: string | undefined;

    if (couponCode) {
      const coupon = await db.coupon.findUnique({ where: { code: couponCode.toUpperCase() }, include: { promotion: true } });
      if (!coupon || !coupon.promotion.active || coupon.promotion.startsAt > now || (coupon.promotion.endsAt && coupon.promotion.endsAt < now)) throw new BadRequestException('Érvénytelen vagy lejárt kupon.');
      if (coupon.minCartGross && subtotal < Number(coupon.minCartGross)) throw new BadRequestException('A kosárérték nem éri el a kupon minimumát.');
      if (coupon.globalLimit !== null && coupon.usedCount >= coupon.globalLimit) throw new BadRequestException('A kupon felhasználási kerete elfogyott.');
      if (userId && coupon.perUserLimit !== null) {
        const used = await db.couponUsage.count({ where: { couponId: coupon.id, userId } });
        if (used >= coupon.perUserLimit) throw new BadRequestException('Ezt a kupont már felhasználtad.');
      }
      couponId = coupon.id;
      const value = Number(coupon.promotion.value);
      if (coupon.promotion.type === PromotionType.PERCENT) couponDiscount = Math.min(discountedSubtotal, Math.round(discountedSubtotal * value / 100));
      if (coupon.promotion.type === PromotionType.FIXED) couponDiscount = Math.min(discountedSubtotal, value);
      if (coupon.promotion.type === PromotionType.FREE_SHIPPING) shipping = 0;
    }

    if (couponDiscount > 0 && discountedSubtotal > 0) {
      let allocated = 0;
      lineQuotes.forEach((line, index) => {
        const room = line.finalGross;
        const share = index === lineQuotes.length - 1 ? couponDiscount - allocated : Math.min(room, Math.round(couponDiscount * room / discountedSubtotal));
        line.discountGross += share; line.finalGross -= share; allocated += share;
      });
    }
    const discount = automaticDiscount + couponDiscount;
    return { subtotalGross: subtotal, automaticDiscountGross: automaticDiscount, couponDiscountGross: couponDiscount, discountGross: discount, shippingGross: shipping, totalGross: subtotal - discount + shipping, couponId, lines: lineQuotes };
  }

  async consumeCoupon(couponId: string, userId: string | undefined, orderId: string, tx: Prisma.TransactionClient) {
    const changed = await tx.$executeRaw`UPDATE "Coupon" SET "usedCount"="usedCount"+1 WHERE "id"=${couponId} AND ("globalLimit" IS NULL OR "usedCount"<"globalLimit")`;
    if (changed !== 1) throw new BadRequestException('A kupon közben elfogyott.');
    await tx.couponUsage.create({ data: { couponId, userId, orderId } });
  }
}
