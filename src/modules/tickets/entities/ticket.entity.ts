import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Ticket, TicketPriority, TicketStatus } from '@prisma/client';

/** API representation of a ticket (used for Swagger response schemas). */
export class TicketEntity implements Ticket {
  @ApiProperty({ format: 'uuid', example: '00000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'TCK-000001' })
  ticketNumber!: string;

  @ApiProperty({ example: 'Exemplo 1' })
  title!: string;

  @ApiProperty({ example: 'Descrição fictícia do chamado Exemplo 1.' })
  description!: string;

  @ApiProperty({ enum: TicketStatus, enumName: 'TicketStatus', example: TicketStatus.OPEN })
  status!: TicketStatus;

  @ApiProperty({ enum: TicketPriority, enumName: 'TicketPriority', example: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Always null in API responses (deleted tickets are never returned).',
  })
  deletedAt!: Date | null;
}
