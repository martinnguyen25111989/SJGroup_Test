import { LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const DEFAULT_LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

function resolveLogLevels(): LogLevel[] {
  const raw = process.env.LOG_LEVEL;
  if (!raw) return ['error', 'warn', 'log'];
  const wanted = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is LogLevel => (DEFAULT_LEVELS as string[]).includes(s));
  return wanted.length ? wanted : ['error', 'warn', 'log'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: resolveLogLevels() });
  const config = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SJ Assignment 2026 — Location & Booking API')
    .setDescription(
      'RESTful backend for managing a building/floor/room tree and room bookings.\n\n' +
        'Booking creation runs three Strategy-pattern rules: department match, capacity, time-in-open-hours.\n\n' +
        'Auth: POST /auth/register or /auth/login to receive a JWT, then click Authorize and paste the token.',
    )
    .setVersion('0.1.0')
    .addTag('auth', 'Register, login, current user')
    .addTag('locations', 'Hierarchical location CRUD')
    .addTag('bookings', 'Room bookings + validation rules')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
