import type { FormularioAgencia } from './tipos';

export const formularioVacio = (): FormularioAgencia => ({ codigo_agencia: '', nombre_agencia: '', nombre_usuario: '', contrasena: '', comision_porcentaje: '12', cupo_animal: '100', jugada_minima: '1', minutos_cierre: '5', fk_grupero: '', activa: true });
