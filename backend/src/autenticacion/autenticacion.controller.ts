import { Body, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto';
import { AutenticacionService } from './autenticacion.service';

@ApiTags('Autenticación')
@Controller('autenticacion')
export class AutenticacionController {
  constructor(private readonly servicio: AutenticacionService) {}

  @Post('iniciar-sesion')
  iniciarSesion(@Body() datos: IniciarSesionDto, @Req() solicitud: { ip?: string; headers: Record<string, string | string[] | undefined> }) {
    return this.servicio.iniciarSesion(datos, this.direccionCliente(solicitud));
  }

  /** Detrás de Nginx la IP real llega en `x-forwarded-for`. */
  private direccionCliente(solicitud: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
    const reenviada = solicitud.headers['x-forwarded-for'];
    const primera = Array.isArray(reenviada) ? reenviada[0] : reenviada?.split(',')[0];
    return (primera ?? solicitud.ip ?? 'desconocida').trim();
  }
}
