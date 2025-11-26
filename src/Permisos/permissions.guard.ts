import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );
    
    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.permissions) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    const hasPermission = requiredPermissions.some(permission =>
      user.permissions.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException('Permisos insuficientes para esta acción');
    }

    return true;
  }
}