import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type AuditEntry = {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  changes?: Prisma.InputJsonValue;
  userId?: string | null;
  username?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deja registro de un acceso o un cambio. Nunca interrumpe la operación que
   * la llamó: si la auditoría falla, se anota el error y la atención sigue.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          changes: entry.changes,
          userId: entry.userId ?? null,
          username: entry.username ?? null,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar la auditoría de ${entry.action} sobre ${entry.entity}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Historial de una ficha, del cambio más reciente al más viejo. */
  async historyFor(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }
}
