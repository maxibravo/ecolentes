import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto } from './dto';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/current-user';

@Controller('adjuntos')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Post()
  @Roles(Role.OPERATOR, Role.OPHTHALMOLOGIST, Role.SOCIAL_DESK, Role.ADMIN)
  upload(@Body() dto: UploadAttachmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.attachments.upload(dto, user);
  }

  @Get(':id')
  read(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.attachments.read(id, user);
  }
}
