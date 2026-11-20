import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';

/** ParseUUIDPipe that reports failures in the API's standard validation format. */
export const parseUuid = (paramName = 'id'): ParseUUIDPipe =>
  new ParseUUIDPipe({
    exceptionFactory: () =>
      new BadRequestException({
        message: 'Validation failed',
        errors: [`${paramName} must be a valid UUID`],
      }),
  });
