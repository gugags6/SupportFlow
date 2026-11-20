import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPriority } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../../common/transformers/trim-string';

export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 5000;

export class CreateTicketDto {
  @ApiProperty({
    description: 'Short summary of the ticket.',
    example: 'Exemplo 1',
    maxLength: TITLE_MAX_LENGTH,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({
    description: 'Detailed description of the issue.',
    example: 'Descrição fictícia do chamado Exemplo 1.',
    maxLength: DESCRIPTION_MAX_LENGTH,
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description!: string;

  @ApiPropertyOptional({
    description: 'Ticket priority. Defaults to MEDIUM.',
    enum: TicketPriority,
    enumName: 'TicketPriority',
    default: TicketPriority.MEDIUM,
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
