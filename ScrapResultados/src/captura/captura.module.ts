import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Animal, HorarioSorteo, Resultado, Sorteo } from '../base-datos/entidades';
import { CapturaController } from './captura.controller';
import { CapturaService } from './servicios/captura.service';
import { ExtractorHtmlService } from './servicios/extractor-html.service';
import { PersistenciaResultadosService } from './servicios/persistencia-resultados.service';

@Module({
  imports: [TypeOrmModule.forFeature([Animal, Sorteo, HorarioSorteo, Resultado])],
  controllers: [CapturaController],
  providers: [CapturaService, ExtractorHtmlService, PersistenciaResultadosService],
})
export class CapturaModule {}
