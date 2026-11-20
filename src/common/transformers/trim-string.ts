import type { TransformFnParams } from 'class-transformer';

/** Trims string values so whitespace-only input is rejected by @IsNotEmpty(). */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
