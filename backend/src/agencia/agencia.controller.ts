import { Controller, Delete, Get, Param, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GuardiaJwt } from '../autenticacion/guardias/guardia-jwt';
import { AgenciaService } from './agencia.service';
import { CrearVentaDto, ValidarVentaDto } from './dto/crear-venta.dto';

@ApiTags('Agencia')
@ApiBearerAuth()
@UseGuards(GuardiaJwt)
@Controller('agencia')
export class AgenciaController {
  constructor(private readonly servicio: AgenciaService) {}

  @Get('inicio') obtenerInicio(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }) { return this.servicio.obtenerInicio(solicitud.usuario as never); }
  @Post('tickets') crearVenta(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Body() datos: CrearVentaDto) { return this.servicio.crearVenta(solicitud.usuario as never, datos); }
  @Post('tickets/validar') validarVenta(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Body() datos: ValidarVentaDto) { return this.servicio.validarVenta(solicitud.usuario as never, datos); }
  @Get('resultados') listarResultados(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Query('fecha') fecha?: string) { return this.servicio.listarResultados(solicitud.usuario as never, fecha); }
  @Get('resumen-ventas') resumenVentas(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Query('desde') desde?: string, @Query('hasta') hasta?: string) { return this.servicio.resumenVentas(solicitud.usuario as never, desde, hasta); }
  @Get('tickets') listarTickets(
    @Request() solicitud: { usuario: { sub: string; tipo_usuario: string } },
    @Query('estado') estado?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('pagina') pagina?: string,
    @Query('tamano') tamano?: string,
  ) {
    return this.servicio.listarTickets(solicitud.usuario as never, {
      estado,
      desde,
      hasta,
      pagina: pagina ? Number(pagina) : undefined,
      tamano: tamano ? Number(tamano) : undefined,
    });
  }
  @Get('tickets/buscar') buscarTicket(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Query('fecha') fecha?: string, @Query('numero') numero?: string) { return this.servicio.buscarTicket(solicitud.usuario as never, fecha, numero); }
  @Get('tickets/:serial/pago') consultarPago(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Param('serial') serial: string) { return this.servicio.consultarPago(solicitud.usuario as never, serial); }
  @Post('tickets/:serial/pagar') pagarTicket(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Param('serial') serial: string) { return this.servicio.pagarTicket(solicitud.usuario as never, serial); }
  @Delete('tickets/:serial') cancelarTicket(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Param('serial') serial: string) { return this.servicio.cancelarTicket(solicitud.usuario as never, serial); }
}
