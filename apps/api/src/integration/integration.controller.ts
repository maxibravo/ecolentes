import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { IntegrationService } from './integration.service';
import { ServiceClientGuard, type AuthenticatedClient } from './service-client.guard';
import { CurrentClient } from './current-client';
import { MonthlyDto } from './dto';

/**
 * Lo que el sistema general del municipio puede consultar: totales, nunca
 * personas. Son los reportes agregados que ya acordamos compartir, y la
 * supresión de los números chicos está puesta acá adentro, no en un parámetro:
 * desde afuera no hay manera de pedir el dato sin ocultar.
 *
 * Va marcado como @Public porque no entra con token de usuario; quien autoriza
 * es ServiceClientGuard, con la credencial de servicio.
 */
@Controller('integracion')
@Public()
@UseGuards(ServiceClientGuard)
export class IntegrationController {
  constructor(private readonly integration: IntegrationService) {}

  /** Para que el otro sistema pueda comprobar que su credencial anda. */
  @Get('estado')
  status(@CurrentClient() client: AuthenticatedClient) {
    return { ok: true, client: client.name };
  }

  @Get('resumen')
  summary(@CurrentClient() client: AuthenticatedClient) {
    return this.integration.summary(client);
  }

  @Get('por-mes')
  monthly(@Query() query: MonthlyDto, @CurrentClient() client: AuthenticatedClient) {
    return this.integration.monthly(query, client);
  }

  @Get('etapas')
  stages(@CurrentClient() client: AuthenticatedClient) {
    return this.integration.stages(client);
  }
}
