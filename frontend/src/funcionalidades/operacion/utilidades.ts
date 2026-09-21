import type { FormularioAgencia, FormularioGrupero } from './tipos';

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
