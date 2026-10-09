import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';

/**
 * Dar de alta y de baja usuarios es del administrador y de nadie más: decide
 * quién entra al sistema y con qué permisos ve datos de salud.
 */
@Controller('usuarios')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get('opticas')
  opticians() {
    return this.users.opticians();
  }

  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.create(dto, actor);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.update(id, dto, actor);
  }

  @Post(':id/contrasena')
  resetPassword(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.resetPassword(id, actor);
  }
}
