import { BadRequestException, Injectable } from '@nestjs/common';
import { InventoryMovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async reserve(tx: Prisma.TransactionClient, productId: string, qty: number, orderId: string, actorId?: string) {
    if (qty <= 0) throw new BadRequestException('Érvénytelen foglalási mennyiség.');
    const balances = await tx.inventoryBalance.findMany({
      where: { productId, warehouse: { active: true } },
      include: { warehouse: true },
      orderBy: { warehouse: { code: 'asc' } },
    });
    let remaining = qty;
    for (const before of balances) {
      if (remaining <= 0) break;
      const available = Math.max(0, before.physical - before.reserved - before.damaged);
      if (!available) continue;
      const wanted = Math.min(remaining, available);
      const changed = await tx.$executeRaw`UPDATE "InventoryBalance" SET "reserved"="reserved"+${wanted} WHERE "id"=${before.id} AND ("physical"-"reserved"-"damaged")>=${wanted}`;
      if (changed !== 1) continue;
      const after = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: before.id } });
      await tx.inventoryMovement.create({ data: { productId, warehouseId: before.warehouseId, type: InventoryMovementType.RESERVATION, quantity: wanted, previousPhysical: before.physical, newPhysical: after.physical, previousReserved: before.reserved, newReserved: after.reserved, orderId, actorId } });
      remaining -= wanted;
    }
    if (remaining > 0) throw new BadRequestException('Nincs elegendő elérhető készlet.');
  }

  async releaseOrder(tx: Prisma.TransactionClient, orderId: string, actorId?: string) {
    const reservations = await tx.inventoryMovement.findMany({ where: { orderId, type: InventoryMovementType.RESERVATION } });
    for (const m of reservations) {
      const terminal = await tx.inventoryMovement.findFirst({ where: { orderId, productId: m.productId, warehouseId: m.warehouseId, type: { in: [InventoryMovementType.RELEASE, InventoryMovementType.SALE] } } });
      if (terminal) continue;
      const b = await tx.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: m.productId, warehouseId: m.warehouseId } } });
      const qty = Math.min(m.quantity, b.reserved);
      if (qty <= 0) continue;
      await tx.inventoryBalance.update({ where: { id: b.id }, data: { reserved: { decrement: qty } } });
      await tx.inventoryMovement.create({ data: { productId: m.productId, warehouseId: m.warehouseId, type: InventoryMovementType.RELEASE, quantity: qty, previousPhysical: b.physical, newPhysical: b.physical, previousReserved: b.reserved, newReserved: b.reserved - qty, orderId, actorId, reason: 'ORDER_CANCELLED' } });
    }
  }

  async commitOrder(tx: Prisma.TransactionClient, orderId: string, actorId?: string) {
    const reservations = await tx.inventoryMovement.findMany({ where: { orderId, type: InventoryMovementType.RESERVATION } });
    for (const m of reservations) {
      const sale = await tx.inventoryMovement.findFirst({ where: { orderId, productId: m.productId, warehouseId: m.warehouseId, type: InventoryMovementType.SALE } });
      if (sale) continue;
      const b = await tx.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: m.productId, warehouseId: m.warehouseId } } });
      if (b.reserved < m.quantity || b.physical < m.quantity) throw new BadRequestException('A foglalt készlet nem teljesíthető.');
      await tx.inventoryBalance.update({ where: { id: b.id }, data: { physical: { decrement: m.quantity }, reserved: { decrement: m.quantity } } });
      await tx.inventoryMovement.create({ data: { productId: m.productId, warehouseId: m.warehouseId, type: InventoryMovementType.SALE, quantity: m.quantity, previousPhysical: b.physical, newPhysical: b.physical - m.quantity, previousReserved: b.reserved, newReserved: b.reserved - m.quantity, orderId, actorId } });
    }
  }

  async transfer(actorId: string, dto: { productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; reason: string; note?: string }) {
    if (!Number.isInteger(dto.quantity) || dto.quantity <= 0 || dto.fromWarehouseId === dto.toWarehouseId) throw new BadRequestException('Érvénytelen raktárközi átadás.');
    return this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.fromWarehouseId } } }),
        tx.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.toWarehouseId } } }),
      ]);
      if (source.physical - source.reserved - source.damaged < dto.quantity) throw new BadRequestException('Nincs elegendő átadható készlet a forrásraktárban.');
      const changed = await tx.$executeRaw`UPDATE "InventoryBalance" SET "physical"="physical"-${dto.quantity} WHERE "id"=${source.id} AND ("physical"-"reserved"-"damaged")>=${dto.quantity}`;
      if (changed !== 1) throw new BadRequestException('A készlet közben megváltozott.');
      const targetAfter = await tx.inventoryBalance.update({ where: { id: target.id }, data: { physical: { increment: dto.quantity } } });
      const sourceAfter = await tx.inventoryBalance.findUniqueOrThrow({ where: { id: source.id } });
      await tx.inventoryMovement.createMany({ data: [
        { productId: dto.productId, warehouseId: dto.fromWarehouseId, type: InventoryMovementType.TRANSFER_OUT, quantity: dto.quantity, previousPhysical: source.physical, newPhysical: sourceAfter.physical, previousReserved: source.reserved, newReserved: source.reserved, actorId, reason: dto.reason, note: dto.note },
        { productId: dto.productId, warehouseId: dto.toWarehouseId, type: InventoryMovementType.TRANSFER_IN, quantity: dto.quantity, previousPhysical: target.physical, newPhysical: targetAfter.physical, previousReserved: target.reserved, newReserved: target.reserved, actorId, reason: dto.reason, note: dto.note },
      ] });
      await this.audit.write({ actorId, action: 'INVENTORY_TRANSFERRED', entityType: 'Product', entityId: dto.productId, before: { warehouseId: dto.fromWarehouseId, physical: source.physical }, after: { warehouseId: dto.toWarehouseId, quantity: dto.quantity } }, tx);
      return { ok: true, source: sourceAfter, target: targetAfter };
    });
  }

  async adjust(actorId: string, dto: { productId: string; warehouseId: string; type: InventoryMovementType; quantity: number; reason: string; note?: string }) {
    if (!Number.isInteger(dto.quantity) || dto.quantity === 0) throw new BadRequestException('A mennyiség nem lehet 0.');
    return this.prisma.$transaction(async (tx) => {
      const b = await tx.inventoryBalance.findUniqueOrThrow({ where: { productId_warehouseId: { productId: dto.productId, warehouseId: dto.warehouseId } } });
      let delta: number;
      switch (dto.type) {
        case InventoryMovementType.RECEIPT:
        case InventoryMovementType.RETURN:
        case InventoryMovementType.TRANSFER_IN:
          delta = Math.abs(dto.quantity);
          break;
        case InventoryMovementType.SCRAP:
        case InventoryMovementType.TRANSFER_OUT:
          delta = -Math.abs(dto.quantity);
          break;
        default:
          delta = dto.quantity;
      }
      if (b.physical + delta < 0) throw new BadRequestException('A fizikai készlet nem mehet negatívba.');
      if (b.physical + delta - b.reserved - b.damaged < 0) throw new BadRequestException('A módosítás a foglalt/sérült készlet miatt túlfoglalást okozna.');
      const after = await tx.inventoryBalance.update({ where: { id: b.id }, data: { physical: { increment: delta } } });
      const move = await tx.inventoryMovement.create({ data: { productId: dto.productId, warehouseId: dto.warehouseId, type: dto.type, quantity: Math.abs(dto.quantity), previousPhysical: b.physical, newPhysical: after.physical, previousReserved: b.reserved, newReserved: b.reserved, actorId, reason: dto.reason, note: dto.note } });
      await this.audit.write({ actorId, action: 'INVENTORY_ADJUSTED', entityType: 'InventoryBalance', entityId: b.id, before: { physical: b.physical }, after: { physical: after.physical, type: dto.type, quantity: dto.quantity } }, tx);
      return move;
    });
  }
}
