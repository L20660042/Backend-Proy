import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Catch, HttpException } from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable()
export class ErrorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        const status = err instanceof HttpException ? err.getStatus() : 500;
        const message = err.message || 'Internal server error';
        return throwError(() => ({
          success: false,
          status,
          message,
          timestamp: new Date().toISOString(),
        }));
      }),
    );
  }
}
