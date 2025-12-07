import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CorsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    // Añadir headers CORS a TODAS las respuestas
    response.header('Access-Control-Allow-Origin', 'http://localhost:5173, https://l20660042.github.io');
    response.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    response.header('Access-Control-Allow-Credentials', 'true');
    response.header('Access-Control-Max-Age', '86400');

    return next.handle();
  }
}