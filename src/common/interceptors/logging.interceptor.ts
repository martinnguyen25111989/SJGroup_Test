import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS ?? 1000);

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const id = req.id ?? '-';
    const start = process.hrtime.bigint();

    this.logger.debug(`→ ${req.method} ${req.originalUrl} [${id}]`);

    return next.handle().pipe(
      tap({
        next: () => this.finish(req, res, id, start, false),
        error: () => this.finish(req, res, id, start, true),
      }),
    );
  }

  private finish(
    req: Request,
    res: Response,
    id: string,
    start: bigint,
    errored: boolean,
  ): void {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const line = `← ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms [${id}]`;
    if (errored) {
      // The exception filter logs the cause; here we just close the trace.
      this.logger.warn(line);
    } else if (ms >= SLOW_REQUEST_MS) {
      this.logger.warn(`SLOW ${line}`);
    } else {
      this.logger.log(line);
    }
  }
}
