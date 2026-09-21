export type Animal = { pk_animal: number; codigo_animal: string; nombre: string; icono: string };

export type Horario = {
  pk_horario_sorteo: number;
  hora: string;
  sorteo: string;
  multiplicador_premio: number;
  disponible: boolean;
};

export type Inicio = {
  fecha_juego: string;
  zona_horaria: string;
  agencia: {
    nombre_agencia: string;
    codigo_agencia: string;
    cupo_animal: number;
    jugada_minima: number;
    minutos_cierre: number;
    comision_porcentaje: number;
  };
  animales: Animal[];
  horarios: Horario[];
};

export type Jugada = { fk_animal: number; fk_horario_sorteo: number; monto: number };

/** Cupo vigente que devuelve el servidor por cada combinación del ticket. */
export type CupoCombinacion = {
  fk_animal: number;
  fk_horario_sorteo: number;
  monto: number;
  vendido_agencia: number;
  disponible_agencia: number;
  vendido_grupero: number | null;
  disponible_grupero: number | null;
  excedido: 'AGENCIA' | 'GRUPERO' | null;
};

export type Ticket = {
  serial: string;
  numero_ticket: number;
  fecha_juego: string;
  total_jugado: number;
  creado_at: string;
  cupos: CupoCombinacion[];
};

export type VerificacionCupo = {
  verificado_at: string;
  fecha_juego: string;
  puede_emitir: boolean;
  mensaje?: string;
  detalle: CupoCombinacion[];
};

export type JugadaTicket = Jugada & {
  pk_jugada_ticket: string;
  estado?: string;
  multiplicador_premio?: number;
  premio?: number;
  animal?: { codigo_animal: string; nombre: string; icono: string };
  horario_sorteo?: { hora: string; sorteo?: { nombre: string } };
};

export type TicketBuscado = {
  serial: string;
  numero_ticket: number;
  fecha_juego: string;
  total_jugado: string;
  estado: string;
  jugadas: JugadaTicket[];
};

export type PagoConsultado = {
  serial: string;
  numero_ticket: number;
  fecha_juego: string;
  estado: string;
  total_pagar: number;
  jugadas_premiadas: JugadaTicket[];
};

export type Pagina<T> = { items: T[]; total: number; pagina: number; tamano: number; tiene_mas: boolean };
