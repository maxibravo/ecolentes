import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuditAction, type User } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type LoginResult = {
  accessToken: string;
  user: { id: string; username: string; fullName: string; role: User['role'] };
  mustChangePassword: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(username: string, password: string, ipAddress?: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { username } });

    // Se verifica el hash incluso cuando el usuario no existe, para que el
    // tiempo de respuesta no delate qué nombres de usuario son válidos.
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const passwordMatches = await argon2.verify(hash, password).catch(() => false);

    if (!user || !user.active || !passwordMatches) {
      await this.audit.record({
        action: AuditAction.LOGIN_FAILED,
        entity: 'User',
        entityId: user?.id ?? null,
        username,
        ipAddress,
      });
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.record({
      action: AuditAction.LOGIN,
      entity: 'User',
      entityId: user.id,
      userId: user.id,
      username: user.username,
      ipAddress,
    });

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    return {
      accessToken,
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role },
      mustChangePassword: user.mustChangePassword,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword).catch(() => false))) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await argon2.hash(newPassword),
        mustChangePassword: false,
      },
    });

    await this.audit.record({
      action: AuditAction.UPDATE,
      entity: 'User',
      entityId: userId,
      userId,
      username: user.username,
      changes: { password: 'cambiada' },
    });
  }

  static hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
}

/** Hash de descarte, con el mismo costo que uno real. */
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHR2YWx1ZXg$Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFy';
