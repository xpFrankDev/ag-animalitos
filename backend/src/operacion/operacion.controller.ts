import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GuardiaJwt } from '../autenticacion/guardias/guardia-jwt';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { CrearAgenciaDto } from './dto/crear-agencia.dto';
import { ActualizarAgenciaDto } from './dto/actualizar-agencia.dto';
import { ActualizarGruperoDto, CrearGruperoDto } from './dto/grupero.dto';
import { OperacionService } from './operacion.service';

type Solicitud = { usuario: { sub: string; tipo_usuario: string } };

@ApiTags('Operación')
@ApiBearerAuth()
@UseGuards(GuardiaJwt)
@Controller('operacion')
export class OperacionController {
  constructor(private readonly servicio: OperacionService) {}

  @Get('inicio') inicio(
    @Request() solicitud: Solicitud,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.servicio.inicio(solicitud.usuario as never, { desde, hasta });
  }
  @Get('tickets') listarTickets(
    @Request() solicitud: Solicitud,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('agencia') agencia?: string,
    @Query('estado') estado?: string,
    @Query('pagina') pagina?: string,
    @Query('tamano') tamano?: string,
  ) {
    return this.servicio.listarTickets(solicitud.usuario as never, {
      desde,
      hasta,
      agencia,
      estado,
      pagina: pagina ? Number(pagina) : undefined,
      tamano: tamano ? Number(tamano) : undefined,
    });
  }
  @Get('resultados') listarResultados(@Request() solicitud: Solicitud, @Query('fecha') fecha?: string) {
    return this.servicio.listarResultados(solicitud.usuario as never, fecha);
  }
  @Get('catalogo-resultados') catalogoResultados(@Request() solicitud: Solicitud) { return this.servicio.catalogoResultados(solicitud.usuario as never); }
  @Post('resultados') registrarResultado(@Request() solicitud: Solicitud, @Body() datos: RegistrarResultadoDto) { return this.servicio.registrarResultado(solicitud.usuario as never, datos); }
  @Delete('resultados/:pk_resultado') eliminarResultado(@Request() solicitud: Solicitud, @Param('pk_resultado') pkResultado: string) { return this.servicio.eliminarResultado(solicitud.usuario as never, pkResultado); }
  @Get('accesos') listarAccesos(@Request() solicitud: Solicitud) { return this.servicio.listarAccesos(solicitud.usuario as never); }
  @Post('accesos/:pk_control_acceso/desbloquear') desbloquearAcceso(@Request() solicitud: Solicitud, @Param('pk_control_acceso') pkControlAcceso: string) { return this.servicio.desbloquearAcceso(solicitud.usuario as never, pkControlAcceso); }
  @Post('agencias') crearAgencia(@Request() solicitud: Solicitud, @Body() datos: CrearAgenciaDto) { return this.servicio.crearAgencia(solicitud.usuario as never, datos); }
  @Patch('agencias/:pk_agencia') actualizarAgencia(@Request() solicitud: Solicitud, @Param('pk_agencia') pkAgencia: string, @Body() datos: ActualizarAgenciaDto) { return this.servicio.actualizarAgencia(solicitud.usuario as never, pkAgencia, datos); }
  @Delete('agencias/:pk_agencia') desactivarAgencia(@Request() solicitud: Solicitud, @Param('pk_agencia') pkAgencia: string) { return this.servicio.desactivarAgencia(solicitud.usuario as never, pkAgencia); }
  @Post('agencias/:pk_agencia/liberar-serial') liberarSerial(@Request() solicitud: Solicitud, @Param('pk_agencia') pkAgencia: string) { return this.servicio.liberarSerial(solicitud.usuario as never, pkAgencia); }
  @Post('gruperos') crearGrupero(@Request() solicitud: Solicitud, @Body() datos: CrearGruperoDto) { return this.servicio.crearGrupero(solicitud.usuario as never, datos); }
  @Patch('gruperos/:pk_grupero') actualizarGrupero(@Request() solicitud: Solicitud, @Param('pk_grupero') pkGrupero: string, @Body() datos: ActualizarGruperoDto) { return this.servicio.actualizarGrupero(solicitud.usuario as never, pkGrupero, datos); }
  @Delete('gruperos/:pk_grupero') desactivarGrupero(@Request() solicitud: Solicitud, @Param('pk_grupero') pkGrupero: string) { return this.servicio.desactivarGrupero(solicitud.usuario as never, pkGrupero); }
}
