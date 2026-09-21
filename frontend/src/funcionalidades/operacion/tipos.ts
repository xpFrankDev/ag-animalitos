export type Vista = 'agencias' | 'tickets' | 'resultados' | 'accesos';

export type Agencia = {
  pk_agencia: string;
  codigo_agencia: string;
  nombre_agencia: string;
  activa: boolean;
  grupero?: string | null;
  operador: string;
  equipo_asignado: boolean;
  equipo?: string | null;
  comision_porcentaje: number;
  cupo_animal: number;
  jugada_minima: number;
  minutos_cierre: number;
};

export type Grupero = {
  pk_grupero: string;
  nombre_completo: string;
  nombre_usuario: string;
  activo: boolean;
  cupo_animal: number;
  comision_porcentaje: number;
  agencias: number;
  venta_grupo: number;
  comision_grupo: number;
};

export type AccesoBloqueado = {
  pk_control_acceso: string;
  tipo: 'USUARIO' | 'IP' | 'EQUIPO';
  clave: string;
  bloqueado_hasta: string | null;
  permanente: boolean;
  vigente: boolean;
  bloqueos_consecutivos: number;
  ultimo_intento_at: string | null;
};

export type Inicio = {
  perfil: { nombre_completo: string; tipo_usuario: 'GRUPERO' | 'BANQUERO' };
  permisos: {
    puede_registrar_resultados: boolean;
    puede_gestionar_gruperos: boolean;
    puede_definir_comision: boolean;
    alcance: 'RED' | 'GRUPO';
  };
  rango: { desde: string; hasta: string };
  resumen: {
    total_vendido: number;
    total_premiado: number;
    total_comision: number;
    comision_gruperos: number;
    resto: number;
    agencias: number;
    tickets: number;
  };
  paginacion: { pagina: number; tamano: number; total: number; tiene_mas: boolean };
  agencias: Agencia[];
  gruperos: Grupero[];
  tickets: {
    serial: string;
    numero_ticket: number;
    fecha_juego: string;
    estado: string;
    total_jugado: string;
    total_premio: string;
    agencia: string;
  }[];
  resultados: {
    pk_resultado: string;
    fecha_juego: string;
    origen: 'AUTOMATICO' | 'MANUAL';
    hora: string;
    sorteo: string;
    codigo_animal: string;
    nombre_animal: string;
    icono_animal: string;
    aplicado: boolean;
  }[];
};

export type Catalogo = {
  animales: { pk_animal: number; codigo_animal: string; nombre: string; icono: string }[];
  horarios: { pk_horario_sorteo: number; hora: string; sorteo: string; multiplicador_premio: number }[];
};

export type FormularioAgencia = {
  codigo_agencia: string;
  nombre_agencia: string;
  nombre_usuario: string;
  contrasena: string;
  comision_porcentaje: string;
  cupo_animal: string;
  jugada_minima: string;
  minutos_cierre: string;
  fk_grupero: string;
  activa: boolean;
};

export type FormularioGrupero = {
  nombre_completo: string;
  nombre_usuario: string;
  contrasena: string;
  cupo_animal: string;
  comision_porcentaje: string;
  activo: boolean;
};
