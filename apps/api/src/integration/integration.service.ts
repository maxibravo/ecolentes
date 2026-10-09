import { Injectable } from '@nestjs/common';
import { AuditAction, CaseStage } from '@prisma/client';
import { suppressSmallCell } from '@ecolentes/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ReportsService } from '../reports/reports.service';
import type { AuthenticatedClient } from './service-client.guard';
import type { MonthlyDto } from './dto';

/** Etapas en las que el expediente ya terminó su recorrido. */
const CLOSED_STAGES: CaseStage[] = [CaseStage.DELIVERED, CaseStage.CLOSED];
/** Cuántos meses devuelve la serie si no piden otra cosa. */
const DEFAULT_MONTHS = 12;
const MAX_MONTHS = 60;

@Injectable()
export class IntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly reports: ReportsService,
  ) {}

  /**
   * El mismo resumen que ve Dirección, pero siempre en su versión compartible:
   * sin nombres y con los barrios de uno y dos casos ocultos. Afuera del
   * sistema no hay forma de pedirlo de otra manera.
   */
  async summary(client: AuthenticatedClient) {
    const data = await this.reports.summaryData(true);
    await this.record(client, 'resumen');
    return data;
  }

  /**
   * Entregas y pedidos por mes, para que el sistema del municipio pueda
   * graficar la evolución sin pedirle una planilla a nadie.
   */
  async monthly(params: MonthlyDto, client: AuthenticatedClient) {
    const months = clampMonths(params.months);
    const since = startOfMonth(new Date());
    since.setMonth(since.getMonth() - (months - 1));

    const [cases, deliveries] = await Promise.all([
      this.prisma.case.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, pairs: true },
      }),
      this.prisma.delivery.findMany({
        where: { deliveredAt: { gte: since } },
        select: { deliveredAt: true, case: { select: { pairs: true } } },
      }),
    ]);

    const serie = monthKeys(since, months).map((month) => {
      const requested = cases.filter((c) => monthKey(c.createdAt) === month);
      const handed = deliveries.filter((d) => monthKey(d.deliveredAt) === month);
      // Un mes con uno o dos casos es tan señalador como un barrio chico.
      return {
        month,
        ...hide('requests', 'requestedPairs', requested.length, sumPairs(requested)),
        ...hide(
          'deliveries',
          'deliveredPairs',
          handed.length,
          sumPairs(handed.map((d) => d.case)),
        ),
      };
    });

    await this.record(client, 'por-mes', { meses: months });
    return { months, suppressed: true, serie };
  }

  /**
   * Cuántos expedientes hay en cada etapa ahora mismo. Es el estado del
   * circuito, no un histórico: sirve para ver si algo se está trabando.
   */
  async stages(client: AuthenticatedClient) {
    const cases = await this.prisma.case.findMany({ select: { stage: true, pairs: true } });

    const byStage = Object.values(CaseStage).map((stage) => {
      const list = cases.filter((c) => c.stage === stage);
      return { stage, ...hide('cases', 'pairs', list.length, sumPairs(list)) };
    });

    await this.record(client, 'etapas');
    return {
      suppressed: true,
      totals: {
        cases: cases.length,
        open: cases.filter((c) => !CLOSED_STAGES.includes(c.stage)).length,
      },
      byStage,
    };
  }

  /**
   * Cada consulta queda registrada con el nombre del sistema que la hizo. Sin
   * esto, "el municipio consultó" no se puede demostrar ni desmentir.
   */
  private async record(
    client: AuthenticatedClient,
    report: string,
    extra?: Record<string, unknown>,
  ): Promise<void> {
    await this.audit.record({
      action: AuditAction.VIEW,
      entity: 'Integration',
      entityId: report,
      // La auditoría guarda personas; acá el que consulta es un sistema, y se
      // anota como tal para que no se confunda con un usuario del municipio.
      username: `servicio:${client.name}`,
      changes: { clienteId: client.id, ...(extra ?? {}) },
    });
  }
}

function sumPairs(list: { pairs: number }[]): number {
  return list.reduce((acc, item) => acc + item.pairs, 0);
}

/**
 * Oculta el par (cantidad de casos, cantidad de anteojos) cuando los casos son
 * uno o dos. Los anteojos se ocultan junto con los casos y no por su cuenta:
 * decir "4 anteojos" en un mes cuyos casos están tapados confirmaría igual que
 * hubo alguien, que es justo lo que la supresión evita.
 */
function hide<C extends string, P extends string>(
  casesKey: C,
  pairsKey: P,
  cases: number,
  pairs: number,
): Record<C | P, number | null> {
  const visible = suppressSmallCell(cases);
  return { [casesKey]: visible, [pairsKey]: visible === null ? null : pairs } as Record<
    C | P,
    number | null
  >;
}

function clampMonths(months: number | undefined): number {
  if (!months || Number.isNaN(months)) return DEFAULT_MONTHS;
  return Math.min(Math.max(Math.trunc(months), 1), MAX_MONTHS);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Los meses de la serie, incluidos los que no tuvieron nada. */
function monthKeys(since: Date, months: number): string[] {
  const keys: string[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < months; i += 1) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}
