import { ApiProperty } from '@nestjs/swagger';
import { TicketEntity } from './ticket.entity';

export class PaginationMeta {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 5, description: 'Total number of matching (non-deleted) tickets.' })
  total!: number;

  @ApiProperty({ example: 1 })
  totalPages!: number;
}

export class PaginatedTicketsEntity {
  @ApiProperty({ type: [TicketEntity] })
  data!: TicketEntity[];

  @ApiProperty({ type: PaginationMeta })
  meta!: PaginationMeta;
}
