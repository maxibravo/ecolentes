import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AuditAction,
  CaseStage,
  IntakeChannel,
  Prisma,
  SocialNetwork,
  type Case,
  type Person,
} from '@prisma/client';
import { SOCIAL_NETWORKS } from '@ecolentes/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { isValidDni, normalizeDni } from '../common/dni';
import { searchText } from '../common/search-text';
import type { AuthenticatedUser } from '../common/current-user';
import type { PublicIntakeDto, SocialIntakeDto } from './dto';

/**
 * Lo único que contesta el formulario público, pase lo que pase: que el pedido
 * llegó. Sin número de expediente, porque los números son correlativos y uno
 * más bajo que el anterior ya delata que esa persona tenía un pedido abierto.
 */
const RECEIVED = {
  message: 'Recibimos tu pedido. Te vamos a llamar al teléfono que dejaste.',
} as const;

/** El pedido sigue abierto mientras no se entregó ni se cerró. */
const OPEN = { stage: { notIn: [CaseStage.DELIVERED, CaseStage.CLOSED] } };

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Carga asistida: la persona que atiende WhatsApp, Facebook o Instagram
   * anota el pedido acá y el expediente entra a la misma bandeja que los demás.
   * No hay integración con Meta; esto es lo que la reemplaza por ahora.
   */
  async fromSocialMedia(dto: SocialIntakeDto, author: AuthenticatedUser) {
    const dni = this.requireDni(dto.dni);

    const existing = await this.findOpenCase(dni);
    if (existing && !dto.force) {
      // Antes de abrir un segundo expediente conviene saber que ya hay uno.
      return { created: false as const, duplicate: this.describe(existing), case: null };
    }

    const person = await this.upsertPerson({
      dni,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      neighborhood: dto.neighborhood,
      // Alguien de Salud habló con la persona, así que la identidad queda dada.
      identityVerified: true,
      createdById: author.id,
    });

    const created = await this.openCase({
      person,
      channel: IntakeChannel.SOCIAL_MEDIA,
      socialNetwork: dto.socialNetwork,
      reason: dto.reason,
      authorId: author.id,
      username: author.username,
      note: `Pedido cargado desde el panel de redes (${SOCIAL_NETWORKS[dto.socialNetwork]})`,
      extraNotes: dto.notes ?? null,
      linkedTo: existing?.code ?? null,
    });

    await this.audit.record({
      action: AuditAction.CREATE,
      entity: 'Case',
      entityId: created.id,
      userId: author.id,
      username: author.username,
      changes: { canal: 'SOCIAL_MEDIA', red: dto.socialNetwork },
    });

    return {
      created: true as const,
      duplicate: existing ? this.describe(existing) : null,
      case: { id: created.id, code: created.code },
    };
  }

  /**
   * El formulario público, el link que se le manda a quien prefiere escribir
   * sus datos. No pide token, así que **la respuesta es siempre la misma**:
   * ni el número de expediente ni el texto cambian según lo que haya en la base.
   * Con cualquier otra respuesta, cualquiera podría probar DNI ajenos y
   * averiguar quién pidió anteojos, que es un dato de salud.
   *
   * La identidad queda sin verificar hasta que un operador hable con la persona.
   */
  async fromPublicForm(dto: PublicIntakeDto) {
    const dni = this.requireDni(dto.dni);

    // Si ya tiene un pedido abierto no se abre otro, pero afuera no se nota:
    // la persona recibe la misma respuesta que si acabara de entrar.
    const existing = await this.findOpenCase(dni);
    if (existing) return RECEIVED;

    const known = await this.prisma.person.findUnique({ where: { dni } });
    const person = await this.upsertPerson({
      dni,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      neighborhood: dto.neighborhood,
      // Nadie la vio: queda por verificar, salvo que ya estuviera verificada.
      identityVerified: known?.identityVerified ?? false,
      createdById: null,
    });

    const created = await this.openCase({
      person,
      channel: IntakeChannel.PUBLIC_FORM,
      socialNetwork: null,
      reason: dto.reason,
      authorId: null,
      username: 'formulario público',
      note: 'Solicitud enviada desde el formulario público. Identidad por verificar',
      extraNotes: null,
      linkedTo: null,
    });

    await this.audit.record({
      action: AuditAction.CREATE,
      entity: 'Case',
      entityId: created.id,
      username: 'formulario público',
      changes: { canal: 'PUBLIC_FORM' },
    });

    return RECEIVED;
  }

  /**
   * Los últimos pedidos que entraron sin pasar por territorio: redes y
   * formulario. Es lo que mira quien atiende los mensajes para saber qué pasó
   * con lo que cargó.
   */
  async recent(viewer: AuthenticatedUser, take = 30) {
    const cases = await this.prisma.case.findMany({
      where: { channel: { in: [IntakeChannel.SOCIAL_MEDIA, IntakeChannel.PUBLIC_FORM] } },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dni: true,
            phone: true,
            neighborhood: true,
            identityVerified: true,
          },
        },
      },
    });

    await this.audit.record({
      action: AuditAction.VIEW,
      entity: 'Report',
      entityId: 'ingresos-por-redes',
      userId: viewer.id,
      username: viewer.username,
    });

    return cases.map((c) => ({
      id: c.id,
      code: c.code,
      stage: c.stage,
      hold: c.hold,
      channel: c.channel,
      socialNetwork: c.socialNetwork,
      reason: c.reason,
      createdAt: c.createdAt,
      person: c.person,
    }));
  }

  /** El operador confirma que habló con la persona y que los datos son suyos. */
  async verifyIdentity(personId: string, author: AuthenticatedUser): Promise<Person> {
    const person = await this.prisma.person.update({
      where: { id: personId },
      data: { identityVerified: true },
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entity: 'Person',
      entityId: person.id,
      userId: author.id,
      username: author.username,
      changes: { identidadVerificada: { de: false, a: true } },
    });

    return person;
  }

  private requireDni(input: string): string {
    if (!isValidDni(input)) {
      throw new BadRequestException('El DNI tiene que tener entre 7 y 8 dígitos');
    }
    return normalizeDni(input);
  }

  private async findOpenCase(dni: string) {
    return this.prisma.case.findFirst({
      where: { person: { dni }, ...OPEN },
      orderBy: { createdAt: 'desc' },
      select: { id: true, code: true, stage: true, createdAt: true },
    });
  }

  private describe(c: { id: string; code: string; stage: CaseStage; createdAt: Date }) {
    return { caseId: c.id, code: c.code, stage: c.stage, createdAt: c.createdAt };
  }

  /**
   * Una ficha por DNI. Si ya existe, sólo se completa lo que estaba vacío: el
   * teléfono que cargó alguien en territorio no se pisa con lo que llegó por
   * un formulario.
   */
  private async upsertPerson(input: {
    dni: string;
    firstName: string;
    lastName: string;
    phone?: string;
    neighborhood?: string;
    identityVerified: boolean;
    createdById: string | null;
  }): Promise<Person> {
    const fill: Prisma.PersonUpdateInput = {};
    const existing = await this.prisma.person.findUnique({ where: { dni: input.dni } });
    if (existing) {
      if (!existing.phone && input.phone?.trim()) fill.phone = input.phone.trim();
      if (!existing.neighborhood && input.neighborhood?.trim()) {
        fill.neighborhood = input.neighborhood.trim();
      }
      if (input.identityVerified && !existing.identityVerified) fill.identityVerified = true;
      return Object.keys(fill).length
        ? this.prisma.person.update({ where: { id: existing.id }, data: fill })
        : existing;
    }

    return this.prisma.person.create({
      data: {
        dni: input.dni,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        searchName: searchText(input.lastName, input.firstName),
        phone: input.phone?.trim() || null,
        neighborhood: input.neighborhood?.trim() || null,
        identityVerified: input.identityVerified,
        createdById: input.createdById,
      },
    });
  }

  /**
   * Abre el expediente. Repite la asignación automática de óptica y el primer
   * evento del historial, igual que cuando se carga desde la bandeja.
   */
  private async openCase(input: {
    person: Person;
    channel: IntakeChannel;
    socialNetwork: SocialNetwork | null;
    reason?: string;
    authorId: string | null;
    username: string;
    note: string;
    extraNotes: string | null;
    linkedTo: string | null;
  }): Promise<Case> {
    const opticians = await this.prisma.optician.findMany({ where: { active: true }, take: 2 });
    const onlyOptician = opticians.length === 1 ? opticians[0]!.id : null;

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.case.findFirst({ orderBy: { code: 'desc' }, select: { code: true } });
      const code = `ECO-${String((last ? Number(last.code.replace(/\D/g, '')) : 0) + 1).padStart(4, '0')}`;

      const newCase = await tx.case.create({
        data: {
          code,
          personId: input.person.id,
          channel: input.channel,
          socialNetwork: input.socialNetwork,
          opticianId: onlyOptician,
          reason: input.reason?.trim() || null,
          createdById: input.authorId,
        },
      });

      const notes = [
        input.note + (input.linkedTo ? `. La persona ya tenía el ${input.linkedTo} abierto` : ''),
        ...(input.extraNotes?.trim() ? [`Notas de la conversación: ${input.extraNotes.trim()}`] : []),
      ];
      for (const note of notes) {
        await tx.caseEvent.create({
          data: {
            caseId: newCase.id,
            toStage: CaseStage.REQUEST,
            note,
            userId: input.authorId,
            username: input.username,
          },
        });
      }

      return newCase;
    });
  }
}
