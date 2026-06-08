import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  reasons?: string[];
  path: string;
  requestId?: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = request.id;

    const { status, message, error, reasons } = this.normalize(exception);
    const body: ErrorBody = {
      statusCode: status,
      message,
      ...(error && { error }),
      ...(reasons && { reasons }),
      path: request.url,
      ...(requestId && { requestId }),
      timestamp: new Date().toISOString(),
    };

    const tag = requestId ? ` [${requestId}]` : '';
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status} ${stringify(message)}${tag}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} -> ${status} ${stringify(message)}${tag}`,
      );
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    message: string | string[];
    error?: string;
    reasons?: string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return { status, message: res };
      }
      const obj = res as Record<string, unknown>;
      return {
        status,
        message: (obj.message as string | string[]) ?? exception.message,
        error: obj.error as string | undefined,
        reasons: obj.reasons as string[] | undefined,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        exception instanceof Error ? exception.message : 'Internal server error',
    };
  }
}

function stringify(message: string | string[]): string {
  return Array.isArray(message) ? message.join('; ') : message;
}
