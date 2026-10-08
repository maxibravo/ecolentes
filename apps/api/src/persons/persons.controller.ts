import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PersonsService } from './persons.service';
import { CreatePersonDto, SearchPersonDto, UpdatePersonDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';

@Controller('personas')
export class PersonsController {
  constructor(private readonly persons: PersonsService) {}

  @Get()
  @Roles(Role.OPERATOR, Role.OPHTHALMOLOGIST, Role.DIRECTOR, Role.SOCIAL_DESK, Role.ADMIN)
  search(@Query() query: SearchPersonDto) {
    return this.persons.search(query);
  }

  /** Lo que consulta el formulario antes de crear: si ya existe, la trae. */
  @Get('por-dni/:dni')
  @Roles(Role.OPERATOR, Role.OPHTHALMOLOGIST, Role.DIRECTOR, Role.SOCIAL_DESK, Role.ADMIN)
  async findByDni(@Param('dni') dni: string) {
    const person = await this.persons.findByDni(dni);
    if (!person) throw new NotFoundException('No hay ninguna ficha con ese DNI');
    return person;
  }

  @Get(':id')
  @Roles(Role.OPERATOR, Role.OPHTHALMOLOGIST, Role.DIRECTOR, Role.SOCIAL_DESK, Role.ADMIN)
  findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.persons.findById(id, user);
  }

  @Get(':id/historial')
  @Roles(Role.DIRECTOR, Role.ADMIN)
  history(@Param('id') id: string) {
    return this.persons.history(id);
  }

  @Post()
  @Roles(Role.OPERATOR, Role.SOCIAL_DESK, Role.ADMIN)
  create(@Body() dto: CreatePersonDto, @CurrentUser() user: AuthenticatedUser) {
    return this.persons.create(dto, user);
  }

  @Patch(':id')
  @Roles(Role.OPERATOR, Role.SOCIAL_DESK, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePersonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.persons.update(id, dto, user);
  }
}
