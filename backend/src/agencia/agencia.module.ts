import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agencia, Animal, Grupero, HorarioSorteo, JugadaTicket, Ticket } from '../base-datos/entidades';
import { AgenciaController } from './agencia.controller';
import { AgenciaService } from './agencia.service';
import { CupoService } from './cupo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Agencia, Animal, Grupero, HorarioSorteo, Ticket, JugadaTicket])],
  controllers: [AgenciaController],
  providers: [AgenciaService, CupoService],
})
export class AgenciaModule {}
