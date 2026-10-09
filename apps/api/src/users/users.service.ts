import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma, Role } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/current-user';
import type { CreateUserDto, UpdateUserDto } from './dto';

/** Lo que se devuelve de un usuario. El hash de la contraseña nunca sale. */
const PUBLIC_FIELDS = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  active: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  opticianId: true,
  optician: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    return this.prisma.user.findMany({
      select: PUBLIC_FIELDS,
      orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
    });
  }

  /** Las ópticas que se pueden elegir al crear un usuario del perfil Óptica. */
  async opticians() {
    return this.prisma.optician.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Crea el usuario con una contraseña generada que se muestra una sola vez.
   * Quien la recibe la cambia al entrar: así la contraseña no la elige quien da
   * el alta, y no queda escrita en ningún lado.
   */
  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    const username = dto.username.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new ConflictException(`Ya hay un usuario que se llama "${username}"`);
    }

    const opticianId = await this.resolveOptician(dto.role, dto.opticianId ?? null);
    const password = generatePassword();

    const user = await this.prisma.user.create({
      data: {
        username,
        fullName: dto.fullName.trim(),
        role: dto.role,
        opticianId,
        passwordHash: await argon2.hash(password),
        mustChangePassword: true,
      },
      select: PUBLIC_FIELDS,
    });

    await this.audit.record({
      action: AuditAction.CREATE,
      entity: 'User',
      entityId: user.id,
      userId: actor.id,
      username: actor.username,
      changes: { usuario: username, perfil: dto.role },
    });

    return { user, password };
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Ese usuario no existe');

    // Nadie se saca a sí mismo el permiso de administrar: si se equivoca, no
    // queda nadie que pueda devolvérselo salvo entrando a la base a mano.
    if (id === actor.id && (dto.active === false || (dto.role && dto.role !== before.role))) {
      throw new BadRequestException(
        'No podés cambiarte el perfil ni darte de baja a vos mismo. Pedíselo a otro administrador',
      );
    }

    const role = dto.role ?? before.role;
    const willBeActive = dto.active ?? before.active;
    if (before.role === Role.ADMIN && (role !== Role.ADMIN || !willBeActive)) {
      await this.ensureAnotherAdminRemains(id);
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName.trim();
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.role !== undefined) data.role = dto.role;

    // El perfil y la óptica se mueven juntos: si deja de ser Óptica, pierde la
    // óptica, y si pasa a serlo, hay que decir cuál.
    if (dto.role !== undefined || dto.opticianId !== undefined) {
      const opticianId = await this.resolveOptician(
        role,
        dto.opticianId !== undefined ? dto.opticianId : before.opticianId,
      );
      data.optician = opticianId ? { connect: { id: opticianId } } : { disconnect: true };
    }

    const user = await this.prisma.user.update({ where: { id }, data, select: PUBLIC_FIELDS });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      username: actor.username,
      changes: diff(before, dto),
    });

    return user;
  }

  /**
   * Para cuando alguien se olvidó la contraseña. Devuelve una nueva, también de
   * un solo uso: el administrador no puede ver la anterior, sólo reemplazarla.
   */
  async resetPassword(id: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Ese usuario no existe');

    const password = generatePassword();
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(password), mustChangePassword: true },
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: id,
      userId: actor.id,
      username: actor.username,
      changes: { password: 'reemplazada por un administrador' },
    });

    return { password };
  }

  /**
   * Un usuario del perfil Óptica sin óptica vería los expedientes de todas, así
   * que el perfil obliga a elegir una. Los demás perfiles no llevan ninguna.
   */
  private async resolveOptician(role: Role, opticianId: string | null): Promise<string | null> {
    if (role !== Role.OPTICIAN) return null;
    if (!opticianId) {
      throw new BadRequestException('El perfil Óptica necesita que elijas a qué óptica pertenece');
    }
    const optician = await this.prisma.optician.findUnique({ where: { id: opticianId } });
    if (!optician) throw new BadRequestException('Esa óptica no existe');
    return optician.id;
  }

  /** Un sistema sin ningún administrador activo no se puede volver a administrar. */
  private async ensureAnotherAdminRemains(excludingId: string): Promise<void> {
    const otros = await this.prisma.user.count({
      where: { role: Role.ADMIN, active: true, id: { not: excludingId } },
    });
    if (otros === 0) {
      throw new BadRequestException(
        'Es el único administrador activo. Creá otro antes de cambiar este',
      );
    }
  }
}

/**
 * Una contraseña que se dicta por teléfono sin pelearse: sin el cero y la O,
 * sin el uno, la ele y la i, y sin el ocho y la B.
 */
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ234567';
const PASSWORD_LENGTH = 12;

export function generatePassword(): string {
  // Se descartan los bytes que caerían fuera del alfabeto en lugar de doblarlos
  // con un módulo, que haría más probables las primeras letras. Y se piden
  // bytes nuevos en vez de reusar los ya descartados, para no repetir.
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  let password = '';
  while (password.length < PASSWORD_LENGTH) {
    for (const byte of randomBytes(PASSWORD_LENGTH)) {
      if (byte >= limit) continue;
      password += ALPHABET[byte % ALPHABET.length];
      if (password.length === PASSWORD_LENGTH) break;
    }
  }
  return password;
}

/** Qué cambió, para la auditoría. Nunca incluye contraseñas. */
function diff(
  before: { fullName: string; role: Role; active: boolean },
  dto: UpdateUserDto,
): Prisma.JsonObject {
  const changes: Prisma.JsonObject = {};
  if (dto.fullName !== undefined && dto.fullName.trim() !== before.fullName) {
    changes.nombre = { antes: before.fullName, ahora: dto.fullName.trim() };
  }
  if (dto.role !== undefined && dto.role !== before.role) {
    changes.perfil = { antes: before.role, ahora: dto.role };
  }
  if (dto.active !== undefined && dto.active !== before.active) {
    changes.activo = { antes: before.active, ahora: dto.active };
  }
  if (dto.opticianId !== undefined) changes.optica = dto.opticianId ?? null;
  return changes;
}
