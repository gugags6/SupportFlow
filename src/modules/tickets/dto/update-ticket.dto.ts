import { PartialType, PickType } from '@nestjs/swagger';
import { CreateTicketDto } from './create-ticket.dto';

/**
 * Only title and description are editable through PATCH /tickets/:id.
 * Any other property (status, priority, ticketNumber, id, timestamps...) is
 * rejected by the global ValidationPipe (forbidNonWhitelisted).
 */
export class UpdateTicketDto extends PartialType(
  PickType(CreateTicketDto, ['title', 'description'] as const),
) {}
