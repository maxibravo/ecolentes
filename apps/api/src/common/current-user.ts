import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '@prisma/client';

export type AuthenticatedUser = {
  id: string;
  username: string;
  role: Role;
  /** Sólo para el rol OPTICIAN: la óptica a la que pertenece. */
  opticianId?: string | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
