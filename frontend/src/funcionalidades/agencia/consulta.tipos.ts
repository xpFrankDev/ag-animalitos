export type VistaConsulta = 'resultados' | 'tickets' | 'resumen';

export type OrigenResultado = 'AUTOMATICO' | 'MANUAL';

export type Resultado = {
  pk_resultado: string;
  hora: string;
  sorteo: string;
  codigo_animal: string;
  nombre_animal: string;
  icono_animal: string;
  origen: OrigenResultado;
};

export type JugadaTicket = {
  monto: string;
  animal?: { codigo_animal: string; nombre: string };
  horario_sorteo?: { hora: string; sorteo?: { nombre: string } };
};

export type Ticket = {
  serial: string;
  numero_ticket: number;
  fecha_juego: string;
  estado: 'ACTIVO' | 'CANCELADO' | 'PREMIADO' | 'PAGADO';
  total_jugado: string;
  total_premio: string;
  monto_pagado: string;
  jugadas?: JugadaTicket[];
};

export type Resumen = {
  desde: string;
  hasta: string;
  total_vendido: number;
  total_premiado: number;
  porcentaje_comision: number;
  total_comision: number;
  resto: number;
  total_tickets: number;
  tickets: Ticket[];
};
