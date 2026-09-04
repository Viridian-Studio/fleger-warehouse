import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AllExceptionsFilter } from './common/logging/all-exceptions.filter';
import { RequestLoggingInterceptor } from './common/logging/request-logging.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmployeesModule } from './modules/employees/employees.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { InventoryCategoriesModule } from './modules/inventory-categories/inventory-categories.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { VehicleFuelLogsModule } from './modules/vehicle-fuel-logs/vehicle-fuel-logs.module';
import { VehicleMaintenanceLogsModule } from './modules/vehicle-maintenance-logs/vehicle-maintenance-logs.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { RolesModule } from './modules/roles/roles.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { FeaturesModule } from './modules/features/features.module';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './modules/health/health.module';
import { ApplicationDetailsModule } from './modules/application-details/application-details.module';
import { SearchModule } from './modules/search/search.module';
import { UpdatesModule } from './modules/updates/updates.module';
import { ShopIntegrationModule } from './modules/shop-integration/shop-integration.module';
import { TenantGuardModule } from './common/tenant/tenant-guard.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['apps/api/.env', '.env'] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI')
      })
    }),
    AuthModule,
    UsersModule,
    TenantsModule,
    RolesModule,
    DepartmentsModule,
    EmployeesModule,
    InventoryCategoriesModule,
    InventoryModule,
    VehiclesModule,
    VehicleMaintenanceLogsModule,
    VehicleFuelLogsModule,
    AssignmentsModule,
    DashboardModule,
    AuditLogModule,
    SubscriptionsModule,
    FeaturesModule,
    PlatformAdminModule,
    NotificationsModule,
    HealthModule,
    ApplicationDetailsModule,
    SearchModule,
    UpdatesModule,
    ShopIntegrationModule,
    TenantGuardModule
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor }
  ]
})
export class AppModule {}
