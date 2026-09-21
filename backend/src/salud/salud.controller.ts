import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { CalificacionService } from '../calificacion/calificacion.service';
import { fechaOperacion, zonaHorariaOperacion } from '../comun/fechas';

/**
 * Estado del servicio para monitoreo y verificación de despliegues.
 * Se mantiene sin autenticación porque no expone datos de negocio.
 */
@ApiTags('Salud')
@Controller('salud')
export class SaludController {
  constructor(
    private readonly origenDatos: DataSource,
    private readonly calificacion: CalificacionService,
  ) {}

  @Get()
  async estado() {
    const calificacion = await this.calificacion.estado();
    return {
      estado: this.origenDatos.isInitialized ? 'ok' : 'sin_base_de_datos',
      base_de_datos: this.origenDatos.isInitialized,
      zona_horaria: zonaHorariaOperacion(),
      fecha_juego: fechaOperacion(),
      hora_servidor: new Date().toISOString(),
      calificacion,
    };
  }
}
