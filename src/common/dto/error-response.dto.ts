import { ApiProperty } from '@nestjs/swagger';

/** Shape of every error response returned by the API. */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({
    type: [String],
    example: ['title should not be empty'],
    description: 'Detailed error messages (empty when there are no details).',
  })
  errors!: string[];

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/v1/tickets' })
  path!: string;
}
