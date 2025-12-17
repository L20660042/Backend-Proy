import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'TU_SECRETO_JWT_CAMBIA_ESTA_CADENA', // pásalo luego a .env
    });
  }

  async validate(payload: any) {
    // lo que regrese aquí se mete como req.user
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
  }
}
