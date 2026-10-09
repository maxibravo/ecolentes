import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { ServiceClientGuard } from './service-client.guard';

@Module({
  imports: [ReportsModule],
  controllers: [IntegrationController],
  providers: [IntegrationService, ServiceClientGuard],
})
export class IntegrationModule {}
