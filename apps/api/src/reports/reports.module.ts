import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  // El módulo de integración reusa el cálculo del resumen, para que la
  // pantalla de Dirección y la API del municipio no se separen con el tiempo.
  exports: [ReportsService],
})
export class ReportsModule {}
