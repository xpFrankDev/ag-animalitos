export enum TipoUsuario {
  AGENCIA = 'AGENCIA',
  GRUPERO = 'GRUPERO',
  BANQUERO = 'BANQUERO',
}

export enum EstadoTicket {
  ACTIVO = 'ACTIVO',
  CANCELADO = 'CANCELADO',
  PREMIADO = 'PREMIADO',
  PAGADO = 'PAGADO',
}

export enum EstadoJugada {
  ACTIVA = 'ACTIVA',
  CANCELADA = 'CANCELADA',
  PREMIADA = 'PREMIADA',
  PAGADA = 'PAGADA',
}

export enum OrigenResultado {
  AUTOMATICO = 'AUTOMATICO',
  MANUAL = 'MANUAL',
}

/** Alcance del control de intentos de acceso. */
export enum TipoControlAcceso {
  USUARIO = 'USUARIO',
  IP = 'IP',
  EQUIPO = 'EQUIPO',
}
