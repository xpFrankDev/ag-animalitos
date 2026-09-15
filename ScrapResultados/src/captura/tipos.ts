export type Programa = 'Lotto Activo' | 'Lotto Internacional' | 'La Granjita';

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
