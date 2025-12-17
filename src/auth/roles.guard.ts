import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { SystemRole } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles =
      this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // no hay restricción de rol
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { roles?: SystemRole[] };

    if (!user || !user.roles) {
      throw new ForbiddenException('Usuario sin roles');
    }

    const hasRole = user.roles.some((role) =>
      requiredRoles.includes(role as SystemRole),
    );

    if (!hasRole) {
      throw new ForbiddenException('No tiene permisos para esta operación');
    }

    return true;
  }
}
