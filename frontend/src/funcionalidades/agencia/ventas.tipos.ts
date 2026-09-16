export type Animal = { pk_animal: number; codigo_animal: string; nombre: string; icono: string };
export type Horario = { pk_horario_sorteo: number; hora: string; sorteo: string; disponible: boolean };
export type Inicio = { agencia: { nombre_agencia: string; codigo_agencia: string; cupo_animal: number; jugada_minima: number; minutos_cierre: number; comision_porcentaje: number }; animales: Animal[]; horarios: Horario[]; multiplicador_premio: number };
export type Jugada = { fk_animal: number; fk_horario_sorteo: number; monto: number };
export type Ticket = { serial: string; numero_ticket: number; total_jugado: number };
export type JugadaTicket = Jugada & { pk_jugada_ticket: string; animal?: { codigo_animal: string; nombre: string; icono: string }; horario_sorteo?: { hora: string; sorteo?: { nombre: string } } };
export type TicketBuscado = { serial: string; numero_ticket: number; fecha_juego: string; total_jugado: string; jugadas: JugadaTicket[] };
export type PagoConsultado = { serial: string; numero_ticket: number; fecha_juego: string; total_pagar: number; jugadas_premiadas: JugadaTicket[] };
