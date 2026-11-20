import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';

interface NormalizedError {
  statusCode: number;
  message: string;
  errors: string[];
}

/**
 * Centralized exception handling. Every error leaves the API with the same
 * shape, and internal details (stack traces, SQL, Prisma metadata) are only
 * logged server-side, never returned to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const normalized = this.normalize(exception);

    if (normalized.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${normalized.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseDto = {
      ...normalized,
      timestamp: new Date().toISOString(),
      path: request.url,
    };
    response.status(normalized.statusCode).json(body);
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return { statusCode: HttpStatus.BAD_REQUEST, message: 'Invalid request data', errors: [] };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errors: [],
    };
  }

  private fromHttpException(exception: HttpException): NormalizedError {
    const statusCode = exception.getStatus();
    const res = exception.getResponse();

    if (typeof res === 'string') {
      return { statusCode, message: res, errors: [] };
    }

    const payload = res as { message?: unknown; errors?: unknown; error?: unknown };
    const errors = Array.isArray(payload.errors)
      ? payload.errors.map(String)
      : Array.isArray(payload.message)
        ? payload.message.map(String)
        : [];
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : errors.length > 0
          ? 'Validation failed'
          : exception.message;

    return { statusCode, message, errors };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): NormalizedError {
    switch (exception.code) {
      case 'P2025':
        return { statusCode: HttpStatus.NOT_FOUND, message: 'Resource not found', errors: [] };
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Resource already exists',
          errors: [],
        };
      default:
        this.logger.error(`Unhandled Prisma error ${exception.code}: ${exception.message}`);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
          errors: [],
        };
    }
  }
}
