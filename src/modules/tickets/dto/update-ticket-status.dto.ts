import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateTicketStatusDto {
  @ApiProperty({
    description: 'New ticket status.',
    enum: TicketStatus,
    enumName: 'TicketStatus',
    example: TicketStatus.IN_PROGRESS,
  })
  @IsNotEmpty()
  @IsEnum(TicketStatus)
  status!: TicketStatus;
}
