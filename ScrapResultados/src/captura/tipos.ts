export type Programa = 'Lotto Activo' | 'Lotto Internacional' | 'La Granjita' | 'Guácharo Activo';

export interface ResultadoExtraido {
  programa: Programa;
  fecha_juego: string;
  hora: string;
  codigo_animal: string;
  url_origen: string;
}

export interface FuenteResultados {
  programa: Programa;
  construirUrl(fecha: string): string;
  enlace_lottoactivo?: 'lotto_activo' | 'lotto_activo_internacional';
}

/**
 * La fuente respondió pero todavía no publica resultados válidos para la fecha
 * (por ejemplo, antes del primer sorteo). No es un fallo: simplemente no se escribe nada.
 */
export class ResultadosNoDisponibles extends Error {
  public constructor(programa: Programa) {
    super(`${programa}: todavía no hay resultados válidos publicados; no se escribe nada.`);
    this.name = 'ResultadosNoDisponibles';
  }
}
