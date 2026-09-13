import { Controller, Delete, Get, Param, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GuardiaJwt } from '../autenticacion/guardia-jwt';
import { AgenciaService } from './agencia.service';
import { CrearVentaDto } from './dto/crear-venta.dto';

@ApiTags('Agencia')
@ApiBearerAuth()
@UseGuards(GuardiaJwt)
@Controller('agencia')
export class AgenciaController {
  constructor(private readonly servicio: AgenciaService) {}

  @Get('inicio') obtenerInicio(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }) { return this.servicio.obtenerInicio(solicitud.usuario as never); }
  @Post('tickets') crearVenta(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Body() datos: CrearVentaDto) { return this.servicio.crearVenta(solicitud.usuario as never, datos); }
  @Get('tickets') listarTickets(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }) { return this.servicio.listarTickets(solicitud.usuario as never); }
  @Delete('tickets/:serial') cancelarTicket(@Request() solicitud: { usuario: { sub: string; tipo_usuario: string } }, @Param('serial') serial: string) { return this.servicio.cancelarTicket(solicitud.usuario as never, serial); }
}
