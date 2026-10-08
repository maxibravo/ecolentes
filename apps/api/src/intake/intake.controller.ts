import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IntakeService } from './intake.service';
import { PublicIntakeDto, SocialIntakeDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';

@Controller('ingresos')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  @Post('redes')
  @Roles(Role.SOCIAL_DESK, Role.OPERATOR, Role.ADMIN)
  fromSocialMedia(@Body() dto: SocialIntakeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.intake.fromSocialMedia(dto, user);
  }

  @Get('redes')
  @Roles(Role.SOCIAL_DESK, Role.OPERATOR, Role.DIRECTOR, Role.ADMIN)
  recent(@CurrentUser() user: AuthenticatedUser) {
    return this.intake.recent(user);
  }

  /** Sin token: es el link que se le manda al vecino. */
  @Post('publico')
  @Public()
  fromPublicForm(@Body() dto: PublicIntakeDto) {
    return this.intake.fromPublicForm(dto);
  }

  @Post('personas/:id/verificar-identidad')
  @Roles(Role.OPERATOR, Role.SOCIAL_DESK, Role.ADMIN)
  verifyIdentity(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.intake.verifyIdentity(id, user);
  }
}
