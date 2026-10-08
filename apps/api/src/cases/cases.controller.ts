import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CasesService } from './cases.service';
import {
  CreateCaseDto,
  DecideQuoteDto,
  DeliveryDto,
  HoldDto,
  ListCasesDto,
  MoveStageDto,
  PrescriptionDto,
  QuoteDto,
} from './dto';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';

@Controller('expedientes')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  list(@Query() query: ListCasesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.list(query, user);
  }

  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.findById(id, user);
  }

  @Post()
  @Roles(Role.OPERATOR, Role.SOCIAL_DESK, Role.ADMIN)
  create(@Body() dto: CreateCaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.create(dto, user);
  }

  @Patch(':id/optica')
  @Roles(Role.OPERATOR, Role.ADMIN)
  assignOptician(
    @Param('id') id: string,
    @Body('opticianId') opticianId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cases.assignOptician(id, opticianId, user);
  }

  @Post(':id/receta')
  @Roles(Role.OPHTHALMOLOGIST, Role.OPERATOR, Role.ADMIN)
  setPrescription(
    @Param('id') id: string,
    @Body() dto: PrescriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cases.setPrescription(id, dto, user);
  }

  @Post(':id/propuesta')
  @Roles(Role.OPTICIAN, Role.ADMIN)
  submitQuote(
    @Param('id') id: string,
    @Body() dto: QuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cases.submitQuote(id, dto, user);
  }

  @Post(':id/aprobacion')
  @Roles(Role.DIRECTOR, Role.ADMIN)
  decideQuote(
    @Param('id') id: string,
    @Body() dto: DecideQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cases.decideQuote(id, dto, user);
  }

  @Post(':id/entrega')
  @Roles(Role.OPERATOR, Role.ADMIN)
  registerDelivery(
    @Param('id') id: string,
    @Body() dto: DeliveryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cases.registerDelivery(id, dto, user);
  }

  @Patch(':id/etapa')
  moveStage(
    @Param('id') id: string,
    @Body() dto: MoveStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cases.moveStage(id, dto, user);
  }

  @Patch(':id/freno')
  @Roles(Role.OPERATOR, Role.SOCIAL_DESK, Role.DIRECTOR, Role.ADMIN)
  setHold(@Param('id') id: string, @Body() dto: HoldDto, @CurrentUser() user: AuthenticatedUser) {
    return this.cases.setHold(id, dto, user);
  }
}
