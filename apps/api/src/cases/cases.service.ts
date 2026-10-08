import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  CaseStage,
  Prisma,
  QuoteStatus,
  type Case,
  type CaseHold,
} from '@prisma/client';
import { canMove, isOverdue, STAGE_RULES } from '@ecolentes/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/current-user';
import { pairsFromText, parsePrescription } from './prescription-text';
import type {
  CreateCaseDto,
  DecideQuoteDto,
  DeliveryDto,
  HoldDto,
  ListCasesDto,
  MoveStageDto,
  PrescriptionDto,
  QuoteDto,
} from './dto';

@Injectable()
export class CasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(params: ListCasesDto, viewer: AuthenticatedUser) {
    const where: Prisma.CaseWhereInput = {};
    if (params.stage) where.stage = params.stage;
    if (params.neighborhood) {
      where.person = {
        neighborhood: { equals: params.neighborhood, mode: Prisma.QueryMode.insensitive },
      };
    }
    if (params.q) {
      where.OR = [
        { code: { contains: params.q, mode: Prisma.QueryMode.insensitive } },
        { person: { lastName: { contains: params.q, mode: Prisma.QueryMode.insensitive } } },
        { person: { dni: { contains: params.q.replace(/\D/g, '') } } },
      ];
    }
    // La óptica ve sólo los expedientes que son suyos, y sólo mientras le
    // corresponden. Sin óptica asignada al usuario no ve ninguno, en lugar de
    // verlos todos.
    if (viewer.role === 'OPTICIAN') {
      where.opticianId = viewer.opticianId ?? '-';
      where.stage = where.stage ?? {
        in: [CaseStage.OPTICIAN_QUOTE, CaseStage.APPROVAL, CaseStage.PRODUCTION],
      };
    }

    const cases = await this.prisma.case.findMany({
      where,
      include: { person: true, optician: true },
      orderBy: { stageSince: 'asc' },
      take: params.take ?? 50,
    });

    const withDelay = cases.map((c) => ({ ...c, overdue: isOverdue(c.stage, c.stageSince) }));
    return params.overdue === 'true' ? withDelay.filter((c) => c.overdue) : withDelay;
  }

  async findById(id: string, viewer: AuthenticatedUser) {
    const found = await this.prisma.case.findUnique({
      where: { id },
      include: {
        person: true,
        optician: true,
        operation: true,
        prescription: true,
        quotes: { orderBy: { version: 'desc' } },
        delivery: true,
        events: { orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!found) throw new NotFoundException('No existe ese expediente');
    this.assertOwnOptician(found.opticianId, viewer);

    await this.audit.record({
      action: AuditAction.VIEW,
      entity: 'Case',
      entityId: found.id,
      userId: viewer.id,
      username: viewer.username,
    });

    return { ...found, overdue: isOverdue(found.stage, found.stageSince) };
  }

  async create(dto: CreateCaseDto, author: AuthenticatedUser): Promise<Case> {
    const person = await this.prisma.person.findUnique({ where: { id: dto.personId } });
    if (!person) throw new NotFoundException('No existe esa ficha de persona');

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await nextCode(tx);
      const newCase = await tx.case.create({
        data: {
          code,
          personId: dto.personId,
          channel: dto.channel,
          operationId: dto.operationId ?? null,
          reason: dto.reason?.trim() || null,
          createdById: author.id,
        },
      });
      await tx.caseEvent.create({
        data: {
          caseId: newCase.id,
          toStage: CaseStage.REQUEST,
          note: 'Solicitud cargada',
          userId: author.id,
          username: author.username,
        },
      });
      return newCase;
    });

    await this.audit.record({
      action: AuditAction.CREATE,
      entity: 'Case',
      entityId: created.id,
      userId: author.id,
      username: author.username,
    });

    return created;
  }

  /** Carga o corrige la receta. La valida el profesional. */
  async setPrescription(caseId: string, dto: PrescriptionDto, author: AuthenticatedUser) {
    const found = await this.requireCase(caseId);

    const parsed = parsePrescription(dto.rawText);
    const values = {
      rawText: dto.rawText.trim(),
      farRightSphere: pick(dto.farRightSphere, parsed.farRightSphere),
      farRightCylinder: pick(dto.farRightCylinder, parsed.farRightCylinder),
      farRightAxis: pick(dto.farRightAxis, parsed.farRightAxis),
      farLeftSphere: pick(dto.farLeftSphere, parsed.farLeftSphere),
      farLeftCylinder: pick(dto.farLeftCylinder, parsed.farLeftCylinder),
      farLeftAxis: pick(dto.farLeftAxis, parsed.farLeftAxis),
      nearAddition: pick(dto.nearAddition, parsed.nearAddition),
      // Sólo el oftalmólogo valida. Si la carga un administrativo, queda sin validar.
      validatedById: author.role === 'OPHTHALMOLOGIST' ? author.id : null,
      validatedAt: author.role === 'OPHTHALMOLOGIST' ? new Date() : null,
    };

    const prescription = await this.prisma.prescription.upsert({
      where: { caseId },
      create: { caseId, ...values },
      update: values,
    });

    await this.prisma.case.update({
      where: { id: caseId },
      data: { pairs: pairsFromText(dto.rawText) },
    });

    await this.prisma.caseEvent.create({
      data: {
        caseId,
        note:
          author.role === 'OPHTHALMOLOGIST'
            ? 'Receta cargada y validada por el profesional'
            : 'Receta cargada, falta que la valide el profesional',
        userId: author.id,
        username: author.username,
      },
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entity: 'Case',
      entityId: found.id,
      userId: author.id,
      username: author.username,
      changes: { receta: values.rawText },
    });

    return prescription;
  }

  /** La óptica propone cristales y armazón. Cada observación genera una versión nueva. */
  async submitQuote(caseId: string, dto: QuoteDto, author: AuthenticatedUser) {
    const found = await this.requireCase(caseId);
    this.assertOwnOptician(found.opticianId, author);
    if (!found.opticianId) {
      throw new BadRequestException('El expediente todavía no tiene óptica asignada');
    }
    if (found.stage !== CaseStage.OPTICIAN_QUOTE) {
      throw new BadRequestException(
        'Sólo se puede cargar una propuesta cuando el expediente está en propuesta óptica',
      );
    }

    const last = await this.prisma.quote.findFirst({
      where: { caseId },
      orderBy: { version: 'desc' },
    });

    const quote = await this.prisma.quote.create({
      data: {
        caseId,
        version: (last?.version ?? 0) + 1,
        opticianId: found.opticianId,
        lenses: dto.lenses.trim(),
        frame: dto.frame.trim(),
        leadDays: dto.leadDays ?? null,
        amount: dto.amount ?? null,
        notes: dto.notes?.trim() || null,
      },
    });

    await this.moveStage(
      caseId,
      { to: CaseStage.APPROVAL, note: `Propuesta versión ${quote.version}` },
      author,
    );

    return quote;
  }

  /** Dirección aprueba y manda a producción, u observa y vuelve a la óptica. */
  async decideQuote(caseId: string, dto: DecideQuoteDto, author: AuthenticatedUser) {
    const found = await this.requireCase(caseId);
    if (found.stage !== CaseStage.APPROVAL) {
      throw new BadRequestException('El expediente no está esperando aprobación');
    }
    if (!dto.approve && !dto.note?.trim()) {
      throw new BadRequestException('Para observar la propuesta hay que decir qué corregir');
    }

    const quote = await this.prisma.quote.findFirst({
      where: { caseId },
      orderBy: { version: 'desc' },
    });
    if (!quote) throw new BadRequestException('No hay ninguna propuesta cargada');

    await this.prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: dto.approve ? QuoteStatus.APPROVED : QuoteStatus.OBSERVED,
        decidedById: author.id,
        decidedAt: new Date(),
        decisionNote: dto.note?.trim() || null,
      },
    });

    const to = dto.approve ? CaseStage.PRODUCTION : CaseStage.OPTICIAN_QUOTE;
    await this.moveStage(
      caseId,
      { to, note: dto.approve ? 'Propuesta aprobada' : `Observada: ${dto.note}` },
      author,
    );

    if (!dto.approve) {
      await this.prisma.case.update({
        where: { id: caseId },
        data: { hold: 'QUOTE_OBSERVED', holdNote: dto.note?.trim() || null },
      });
    }

    return this.prisma.case.findUniqueOrThrow({ where: { id: caseId } });
  }

  async moveStage(caseId: string, dto: MoveStageDto, author: AuthenticatedUser): Promise<Case> {
    const found = await this.requireCase(caseId);

    if (!canMove(found.stage, dto.to, author.role)) {
      const rule = STAGE_RULES[found.stage];
      throw new ForbiddenException(
        rule.next.includes(dto.to)
          ? 'Tu rol no puede mover el expediente desde esta etapa'
          : `Desde ${found.stage} no se puede pasar a ${dto.to}`,
      );
    }

    if (dto.to === CaseStage.OPTICIAN_QUOTE && !found.opticianId) {
      throw new BadRequestException('Antes de mandarlo a la óptica hay que asignar una');
    }
    if (dto.to === CaseStage.OPTICIAN_QUOTE && found.stage === CaseStage.ASSESSMENT) {
      const prescription = await this.prisma.prescription.findUnique({ where: { caseId } });
      if (!prescription?.validatedAt) {
        throw new BadRequestException(
          'La receta tiene que estar validada por el profesional antes de ir a la óptica',
        );
      }
    }
    if (dto.to === CaseStage.DELIVERED) {
      const delivery = await this.prisma.delivery.findUnique({ where: { caseId } });
      if (!delivery) {
        throw new BadRequestException('Registrá la entrega antes de marcarlo entregado');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.case.update({
        where: { id: caseId },
        data: {
          stage: dto.to,
          stageSince: new Date(),
          closedAt: dto.to === CaseStage.CLOSED ? new Date() : null,
          // Mover el expediente lo destraba: el motivo dejó de aplicar.
          hold: null,
          holdNote: null,
        },
      });
      await tx.caseEvent.create({
        data: {
          caseId,
          fromStage: found.stage,
          toStage: dto.to,
          note: dto.note?.trim() || null,
          userId: author.id,
          username: author.username,
        },
      });
      return next;
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entity: 'Case',
      entityId: caseId,
      userId: author.id,
      username: author.username,
      changes: { etapa: { de: found.stage, a: dto.to } },
    });

    return updated;
  }

  async registerDelivery(caseId: string, dto: DeliveryDto, author: AuthenticatedUser) {
    await this.requireCase(caseId);

    const delivery = await this.prisma.delivery.upsert({
      where: { caseId },
      create: {
        caseId,
        deliveredAt: new Date(dto.deliveredAt),
        receivedBy: dto.receivedBy.trim(),
        isRepresentative: dto.isRepresentative ?? false,
        note: dto.note?.trim() || null,
        handedById: author.id,
      },
      update: {
        deliveredAt: new Date(dto.deliveredAt),
        receivedBy: dto.receivedBy.trim(),
        isRepresentative: dto.isRepresentative ?? false,
        note: dto.note?.trim() || null,
        handedById: author.id,
      },
    });

    await this.moveStage(
      caseId,
      { to: CaseStage.DELIVERED, note: `Recibió ${delivery.receivedBy}` },
      author,
    );

    return delivery;
  }

  /** Frena el expediente sin cerrarlo: la persona sigue esperando. */
  async setHold(caseId: string, dto: HoldDto, author: AuthenticatedUser): Promise<Case> {
    await this.requireCase(caseId);

    const updated = await this.prisma.case.update({
      where: { id: caseId },
      data: { hold: dto.hold as CaseHold, holdNote: dto.note?.trim() || null },
    });

    await this.prisma.caseEvent.create({
      data: {
        caseId,
        hold: dto.hold as CaseHold,
        note: dto.note?.trim() || null,
        userId: author.id,
        username: author.username,
      },
    });

    return updated;
  }

  async assignOptician(caseId: string, opticianId: string, author: AuthenticatedUser) {
    await this.requireCase(caseId);
    const optician = await this.prisma.optician.findUnique({ where: { id: opticianId } });
    if (!optician) throw new NotFoundException('No existe esa óptica');

    const updated = await this.prisma.case.update({
      where: { id: caseId },
      data: { opticianId },
    });

    await this.prisma.caseEvent.create({
      data: {
        caseId,
        note: `Óptica asignada: ${optician.name}`,
        userId: author.id,
        username: author.username,
      },
    });

    return updated;
  }

  /**
   * Un usuario de una óptica no tiene por qué ver los expedientes de otra.
   * Se responde "no existe" y no "no podés", para no confirmar que existe.
   */
  private assertOwnOptician(caseOpticianId: string | null, viewer: AuthenticatedUser): void {
    if (viewer.role !== 'OPTICIAN') return;
    if (!viewer.opticianId || caseOpticianId !== viewer.opticianId) {
      throw new NotFoundException('No existe ese expediente');
    }
  }

  private async requireCase(id: string): Promise<Case> {
    const found = await this.prisma.case.findUnique({ where: { id } });
    if (!found) throw new NotFoundException('No existe ese expediente');
    return found;
  }
}

function pick(given: number | undefined, parsed: number | null): number | null {
  return given !== undefined ? given : parsed;
}

/** ECO-0001, ECO-0002… Es el número que la gente dice por teléfono. */
async function nextCode(tx: Prisma.TransactionClient): Promise<string> {
  const last = await tx.case.findFirst({ orderBy: { code: 'desc' }, select: { code: true } });
  const lastNumber = last ? Number(last.code.replace(/\D/g, '')) : 0;
  return `ECO-${String(lastNumber + 1).padStart(4, '0')}`;
}
