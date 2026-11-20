import { ApiProperty } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateTicketPriorityDto {
  @ApiProperty({
    description: 'New ticket priority.',
    enum: TicketPriority,
    enumName: 'TicketPriority',
    example: TicketPriority.HIGH,
  })
  @IsNotEmpty()
  @IsEnum(TicketPriority)
  priority!: TicketPriority;
}
