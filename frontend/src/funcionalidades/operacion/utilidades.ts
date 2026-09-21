import type { Agencia, FormularioAgencia, FormularioGrupero, Grupero } from './tipos';

export const formularioAgenciaVacio = (): FormularioAgencia => ({
  codigo_agencia: '',
  nombre_agencia: '',
  nombre_usuario: '',
  contrasena: '',
  comision_porcentaje: '12',
  cupo_animal: '100',
  jugada_minima: '1',
  minutos_cierre: '5',
  fk_grupero: '',
  activa: true,
});

export const formularioGruperoVacio = (): FormularioGrupero => ({
  nombre_completo: '',
  nombre_usuario: '',
  contrasena: '',
  cupo_animal: '500',
  comision_porcentaje: '3',
  activo: true,
});

/** Datos editables de una agencia existente. La contraseña solo se cambia al crearla. */
export const formularioAgenciaDeAgencia = (agencia: Agencia): FormularioAgencia => ({
  codigo_agencia: agencia.codigo_agencia,
  nombre_agencia: agencia.nombre_agencia,
  nombre_usuario: agencia.operador,
  contrasena: '',
  comision_porcentaje: String(agencia.comision_porcentaje ?? 12),
  cupo_animal: String(agencia.cupo_animal ?? 100),
  jugada_minima: String(agencia.jugada_minima ?? 1),
  minutos_cierre: String(agencia.minutos_cierre ?? 5),
  fk_grupero: agencia.grupero ?? '',
  activa: agencia.activa,
});

/**
 * Clonado: se toman los valores operativos de la agencia de referencia y se dejan libres
 * el código, el usuario y la contraseña, que son la identidad propia de la nueva agencia.
 */
export const formularioAgenciaClon = (agencia: Agencia): FormularioAgencia => ({
  ...formularioAgenciaDeAgencia(agencia),
  codigo_agencia: '',
  nombre_agencia: `${agencia.nombre_agencia} (copia)`,
  nombre_usuario: '',
  contrasena: '',
  activa: true,
});

/** Datos editables de un grupero existente. */
export const formularioGruperoDeGrupero = (grupero: Grupero): FormularioGrupero => ({
  nombre_completo: grupero.nombre_completo,
  nombre_usuario: grupero.nombre_usuario,
  contrasena: '',
  cupo_animal: String(grupero.cupo_animal ?? 500),
  comision_porcentaje: String(grupero.comision_porcentaje ?? 3),
  activo: grupero.activo,
});

/** Clonado: se copian cupo y comisión; nombre, usuario y contraseña son nuevos. */
export const formularioGruperoClon = (grupero: Grupero): FormularioGrupero => ({
  ...formularioGruperoDeGrupero(grupero),
  nombre_completo: `${grupero.nombre_completo} (copia)`,
  nombre_usuario: '',
  contrasena: '',
  activo: true,
});
