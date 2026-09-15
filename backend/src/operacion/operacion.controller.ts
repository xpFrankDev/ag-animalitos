import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GuardiaJwt } from '../autenticacion/guardia-jwt';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { OperacionService } from './operacion.service';

type Solicitud = { usuario: { sub: string; tipo_usuario: string } };

@ApiTags('Operación')
@ApiBearerAuth()
@UseGuards(GuardiaJwt)
@Controller('operacion')
export class OperacionController {
  constructor(private readonly servicio: OperacionService) {}

  @Get('inicio') inicio(@Request() solicitud: Solicitud, @Query('desde') desde?: string, @Query('hasta') hasta?: string) { return this.servicio.inicio(solicitud.usuario as never, desde, hasta); }
  @Get('catalogo-resultados') catalogoResultados(@Request() solicitud: Solicitud) { return this.servicio.catalogoResultados(solicitud.usuario as never); }
  @Post('resultados') registrarResultado(@Request() solicitud: Solicitud, @Body() datos: RegistrarResultadoDto) { return this.servicio.registrarResultado(solicitud.usuario as never, datos); }
  @Post('agencias/:pk_agencia/liberar-serial') liberarSerial(@Request() solicitud: Solicitud, @Param('pk_agencia') pkAgencia: string) { return this.servicio.liberarSerial(solicitud.usuario as never, pkAgencia); }
}
