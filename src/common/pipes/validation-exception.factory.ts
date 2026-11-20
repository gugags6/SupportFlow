import { BadRequestException, ValidationError } from '@nestjs/common';

function flatten(errors: ValidationError[], parentPath = ''): string[] {
  return errors.flatMap((error) => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {});
    const nested = error.children?.length ? flatten(error.children, path) : [];
    return [...own, ...nested];
  });
}

/** Converts class-validator errors into the API's standard validation error payload. */
export function validationExceptionFactory(errors: ValidationError[]): BadRequestException {
  return new BadRequestException({
    message: 'Validation failed',
    errors: flatten(errors),
  });
}
