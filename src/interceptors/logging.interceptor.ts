import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body } = request;

    const now = Date.now();
    this.logger.log(`Incoming Request: ${method} ${url} - Body: ${JSON.stringify(body)}`);

    return next.handle().pipe(
      tap((data) => {
        const responseTime = Date.now() - now;
        this.logger.log(`Response: ${method} ${url} - ${responseTime}ms`);
      }),
    );
  }
}
