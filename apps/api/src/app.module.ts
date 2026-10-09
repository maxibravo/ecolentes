import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { UsersModule } from './users/users.module';
import { PersonsModule } from './persons/persons.module';
import { CasesModule } from './cases/cases.module';
import { IntakeModule } from './intake/intake.module';
import { ReportsModule } from './reports/reports.module';
import { IntegrationModule } from './integration/integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // El .env es uno solo y vive en la raíz del monorepo, pero la API
      // arranca desde apps/api. Sin la segunda ruta, `pnpm dev` sobre un clon
      // recién hecho no encuentra ni DATABASE_URL ni JWT_SECRET. En Docker no
      // hay archivo y las variables llegan por el entorno, que siempre gana.
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    PersonsModule,
    CasesModule,
    IntakeModule,
    ReportsModule,
    IntegrationModule,
  ],
  controllers: [HealthController],
  providers: [
    // Todo pide token salvo lo marcado con @Public, y el rol se controla después.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
