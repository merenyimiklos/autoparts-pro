import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CacheModule } from './cache/cache.module';
import { AuditModule } from './audit/audit.module';
import { MailModule } from './mail/mail.module';import { JobsModule } from './jobs/jobs.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { StorageModule } from './storage/storage.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';
import { PromotionsModule } from './promotions/promotions.module';
import { CustomerModule } from './customer/customer.module';
import { HealthController } from './health.controller';
@Module({imports:[ConfigModule.forRoot({isGlobal:true}),PrismaModule,CacheModule,AuditModule,MailModule,JobsModule,AuthModule,ProductsModule,CartModule,OrdersModule,InventoryModule,VehiclesModule,StorageModule,PaymentsModule,AdminModule,PromotionsModule,CustomerModule],controllers:[HealthController]})export class AppModule{}
