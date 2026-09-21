import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JugadaTicket, Resultado, Ticket } from '../base-datos/entidades';
import { CalificacionService } from './calificacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([Resultado, JugadaTicket, Ticket])],
  providers: [CalificacionService],
  exports: [CalificacionService],
})
export class CalificacionModule {}
