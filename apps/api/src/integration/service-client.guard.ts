import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { parseServiceKey } from './service-key';

export type AuthenticatedClient = { id: string; name: string };

/**
 * Deja pasar a un sistema, no a una persona. La credencial viaja en el
 * encabezado `X-API-Key` y no vale para ninguna otra parte de la API: estas
 * rutas no entienden tokens de usuario y las de usuarios no entienden claves.
 */
@Injectable()
export class ServiceClientGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { serviceClient?: AuthenticatedClient }>();

    const header = request.headers['x-api-key'];
    const key = Array.isArray(header) ? header[0] : header;
    if (!key) throw new UnauthorizedException('Falta la credencial de servicio');

    const parsed = parseServiceKey(key);
    // Una clave mal formada y una inexistente dan el mismo error: desde afuera
    // no se puede ir tanteando cuál es la forma correcta.
    if (!parsed) throw new UnauthorizedException('La credencial de servicio no es válida');

    const client = await this.prisma.serviceClient.findUnique({
      where: { keyPrefix: parsed.prefix },
    });
    if (!client || !client.active || client.revokedAt !== null) {
      throw new UnauthorizedException('La credencial de servicio no es válida');
    }

    const matches = await argon2.verify(client.keyHash, parsed.secret).catch(() => false);
    if (!matches) throw new UnauthorizedException('La credencial de servicio no es válida');

    // Sirve para ver de un vistazo qué credenciales siguen en uso y cuáles
    // quedaron olvidadas. No reemplaza a la auditoría, que guarda cada consulta.
    await this.prisma.serviceClient
      .update({ where: { id: client.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);

    request.serviceClient = { id: client.id, name: client.name };
    return true;
  }
}
