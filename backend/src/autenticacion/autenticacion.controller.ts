import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto';
import { AutenticacionService } from './autenticacion.service';

@ApiTags('Autenticación')
@Controller('autenticacion')
export class AutenticacionController {
  constructor(private readonly servicio: AutenticacionService) {}

  @Post('iniciar-sesion')
  iniciarSesion(@Body() datos: IniciarSesionDto) {
    return this.servicio.iniciarSesion(datos);
  }
}
