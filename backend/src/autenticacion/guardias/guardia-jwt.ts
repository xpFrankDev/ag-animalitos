import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class GuardiaJwt implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const solicitud = contexto.switchToHttp().getRequest<{ headers: { authorization?: string }; usuario?: Record<string, unknown> }>();
    const encabezado = solicitud.headers.authorization;
    if (!encabezado?.startsWith('Bearer ')) throw new UnauthorizedException('Sesión no válida.');
    try {
      solicitud.usuario = this.jwt.verify<Record<string, unknown>>(encabezado.slice(7));
      return true;
    } catch {
      throw new UnauthorizedException('Sesión vencida o no válida.');
    }
  }
}
