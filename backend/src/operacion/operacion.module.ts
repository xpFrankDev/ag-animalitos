import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agencia, Animal, Grupero, HorarioSorteo, Resultado, Ticket, Usuario } from '../base-datos/entidades';
import { OperacionController } from './operacion.controller';
import { OperacionService } from './operacion.service';

@Module({
  imports: [TypeOrmModule.forFeature([Agencia, Animal, Grupero, HorarioSorteo, Resultado, Ticket, Usuario])],
  controllers: [OperacionController],
  providers: [OperacionService],
})
export class OperacionModule {}
