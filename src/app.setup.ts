import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validationExceptionFactory } from './common/pipes/validation-exception.factory';

export const API_PREFIX = 'api/v1';
export const DOCS_PATH = 'api/docs';

/**
 * Applies global HTTP configuration. Shared by main.ts and the e2e tests so
 * tests exercise exactly the same pipeline as the running application.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SupportFlow API')
    .setDescription(
      'SupportFlow Ticket Management REST API (initial release). All data is fictional example data.',
    )
    .setVersion('0.1.0')
    .addTag('Tickets', 'Support ticket management')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(DOCS_PATH, app, document);
}
