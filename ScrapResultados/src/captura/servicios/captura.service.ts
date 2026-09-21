import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExtractorHtmlService } from './extractor-html.service';
import { fechaEnZonaHoraria } from '../utilidades/normalizador-resultados';
import { PersistenciaResultadosService } from './persistencia-resultados.service';
import { FuenteResultados, ResultadosNoDisponibles } from '../tipos';

const fuentes: FuenteResultados[] = [
  { programa: 'Lotto Activo', enlace_lottoactivo: 'lotto_activo', construirUrl: (fecha) => `https://www.lottoactivo.com/resultados/animalitos/${fecha}/` },
  { programa: 'Lotto Internacional', enlace_lottoactivo: 'lotto_activo_internacional', construirUrl: (fecha) => `https://www.lottoactivo.com/resultados/lotto_activo_internacional/${fecha}/` },
  { programa: 'La Granjita', construirUrl: (fecha) => `https://loteriadehoy.com/animalito/lagranjita/resultados/${fecha}/` },
];

@Injectable()
export class CapturaService {
  private readonly logger = new Logger(CapturaService.name);
  private enEjecucion = false;
  private ultimaEjecucion?: Date;

  constructor(private readonly extractor: ExtractorHtmlService, private readonly persistencia: PersistenciaResultadosService) {}

  @Cron(process.env.EXPRESION_CRON ?? '3,17,33,47 8-19 * * *', { timeZone: process.env.ZONA_HORARIA ?? 'America/Caracas' })
  async capturarProgramado(): Promise<void> {
    await this.capturarTodo();
  }

  async capturarTodo(): Promise<{ insertados: number; existentes: number; sin_resultados: string[]; errores: string[] }> {
    if (this.enEjecucion) {
      this.logger.warn('Se omitió la ejecución: la captura anterior todavía está en curso.');
      return { insertados: 0, existentes: 0, sin_resultados: [], errores: ['Captura ya en ejecución.'] };
    }
    this.enEjecucion = true;
    this.ultimaEjecucion = new Date();
    const fecha = fechaEnZonaHoraria(process.env.ZONA_HORARIA ?? 'America/Caracas');
    let insertados = 0;
    let existentes = 0;
    const sinResultados: string[] = [];
    const errores: string[] = [];
    try {
      for (const fuente of fuentes) {
        try {
          const extraidos = await this.extractor.extraer(fuente, fecha);
          for (const resultado of extraidos) {
            const estado = await this.persistencia.guardarNuevos(resultado);
            if (estado === 'insertado') insertados += 1;
            else existentes += 1;
          }
        } catch (error) {
          const mensaje = error instanceof Error ? error.message : String(error);
          if (error instanceof ResultadosNoDisponibles) {
            sinResultados.push(mensaje);
            this.logger.warn(mensaje);
            continue;
          }
          errores.push(mensaje);
          this.logger.error(mensaje);
        }
      }
      this.logger.log(
        `Captura finalizada: ${insertados} insertados, ${existentes} existentes, ${sinResultados.length} sin resultados, ${errores.length} errores.`,
      );
      return { insertados, existentes, sin_resultados: sinResultados, errores };
    } finally {
      this.enEjecucion = false;
    }
  }

  estado(): { en_ejecucion: boolean; ultima_ejecucion?: string } {
    return { en_ejecucion: this.enEjecucion, ultima_ejecucion: this.ultimaEjecucion?.toISOString() };
  }
}
