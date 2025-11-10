import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new UnauthorizedException('Token no proporcionado');
      }

      const token = authHeader.replace('Bearer ', '');
      
      if (!token) {
        throw new UnauthorizedException('Token no proporcionado');
      }

      const payload = this.jwtService.verify(token);
      request.user = payload;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}