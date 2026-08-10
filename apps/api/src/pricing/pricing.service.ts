import { BadRequestException,Injectable } from '@nestjs/common';
import { Prisma,PromotionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export type PriceLine={productId:string;quantity:number;grossPrice:number};
@Injectable() export class PricingService{
 constructor(private readonly prisma:PrismaService){}
 async quote(lines:PriceLine[],couponCode:string|undefined,userId:string|undefined,shippingMethod:string,tx?:Prisma.TransactionClient){
  const db=tx??this.prisma; const subtotal=lines.reduce((s,l)=>s+l.grossPrice*l.quantity,0); const baseShipping=shippingMethod==='pickup'?0:shippingMethod==='parcel'?1490:1990; let discount=0,shipping=baseShipping,couponId:string|undefined;
  if(couponCode){const now=new Date();const coupon=await db.coupon.findUnique({where:{code:couponCode.toUpperCase()},include:{promotion:true}});if(!coupon||!coupon.promotion.active||coupon.promotion.startsAt>now||(coupon.promotion.endsAt&&coupon.promotion.endsAt<now))throw new BadRequestException('Érvénytelen vagy lejárt kupon.');if(coupon.minCartGross&&subtotal<Number(coupon.minCartGross))throw new BadRequestException('A kosárérték nem éri el a kupon minimumát.');if(coupon.globalLimit!==null&&coupon.usedCount>=coupon.globalLimit)throw new BadRequestException('A kupon felhasználási kerete elfogyott.');if(userId&&coupon.perUserLimit!==null){const used=await db.couponUsage.count({where:{couponId:coupon.id,userId}});if(used>=coupon.perUserLimit)throw new BadRequestException('Ezt a kupont már felhasználtad.');}couponId=coupon.id;const v=Number(coupon.promotion.value);if(coupon.promotion.type===PromotionType.PERCENT)discount=Math.min(subtotal,Math.round(subtotal*v/100));if(coupon.promotion.type===PromotionType.FIXED)discount=Math.min(subtotal,v);if(coupon.promotion.type===PromotionType.FREE_SHIPPING)shipping=0;}
  return {subtotalGross:subtotal,discountGross:discount,shippingGross:shipping,totalGross:subtotal-discount+shipping,couponId};
 }
 async consumeCoupon(couponId:string,userId:string|undefined,orderId:string,tx:Prisma.TransactionClient){const changed=await tx.$executeRaw`UPDATE "Coupon" SET "usedCount"="usedCount"+1 WHERE "id"=${couponId} AND ("globalLimit" IS NULL OR "usedCount"<"globalLimit")`;if(changed!==1)throw new BadRequestException('A kupon közben elfogyott.');await tx.couponUsage.create({data:{couponId,userId,orderId}});}
}
