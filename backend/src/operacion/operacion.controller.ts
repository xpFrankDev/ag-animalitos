import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GuardiaJwt } from '../autenticacion/guardia-jwt';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { CrearAgenciaDto } from './dto/crear-agencia.dto';
import { ActualizarAgenciaDto } from './dto/actualizar-agencia.dto';
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
  @Post('agencias') crearAgencia(@Request() solicitud: Solicitud, @Body() datos: CrearAgenciaDto) { return this.servicio.crearAgencia(solicitud.usuario as never, datos); }
  @Patch('agencias/:pk_agencia') actualizarAgencia(@Request() solicitud: Solicitud, @Param('pk_agencia') pkAgencia: string, @Body() datos: ActualizarAgenciaDto) { return this.servicio.actualizarAgencia(solicitud.usuario as never, pkAgencia, datos); }
  @Delete('agencias/:pk_agencia') desactivarAgencia(@Request() solicitud: Solicitud, @Param('pk_agencia') pkAgencia: string) { return this.servicio.desactivarAgencia(solicitud.usuario as never, pkAgencia); }
  @Post('agencias/:pk_agencia/liberar-serial') liberarSerial(@Request() solicitud: Solicitud, @Param('pk_agencia') pkAgencia: string) { return this.servicio.liberarSerial(solicitud.usuario as never, pkAgencia); }
}
