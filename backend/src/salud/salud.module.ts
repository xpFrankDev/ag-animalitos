import { Module } from '@nestjs/common';
import { CalificacionModule } from '../calificacion/calificacion.module';
import { SaludController } from './salud.controller';

@Module({
  imports: [CalificacionModule],
  controllers: [SaludController],
})
export class SaludModule {}
