import type { Horario } from './ventas.tipos';

export function claveCupo(fkAnimal: number, fkHorarioSorteo: number) { return `${fkAnimal}-${fkHorarioSorteo}`; }

export function formatearCodigoAnimal(codigo: string) { return codigo === '0' ? codigo : codigo.padStart(2, '0'); }

export function minutosEnVenezuela(fecha: Date) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(fecha);
  const hora = Number(partes.find((parte) => parte.type === 'hour')?.value ?? 0);
  const minuto = Number(partes.find((parte) => parte.type === 'minute')?.value ?? 0);
  return hora * 60 + minuto;
}

export function sigueDisponible(horario: Horario, minutosCierre: number, minutosActuales: number) {
  const [hora, minuto] = horario.hora.split(':').map(Number);
  return horario.disponible && minutosActuales < (hora * 60) + minuto - minutosCierre;
}

export function codigoAnimalComparable(codigo: string) {
  const valor = codigo.trim();
  if (valor === '0' || valor === '00') return valor;
  const numero = Number(valor);
  // Los sorteos clásicos llegan al 36 y Guácharo Activo al 75; la lista activa decide cuáles existen.
  return Number.isInteger(numero) && numero >= 1 && numero <= 99 ? formatearCodigoAnimal(String(numero)) : '';
}

/** Valor numérico del código para ordenar listas: «00» y «0» van primero. */
export function valorCodigoAnimal(codigo: string) {
  const numero = Number.parseInt(codigo, 10);
  return Number.isNaN(numero) ? Number.MAX_SAFE_INTEGER : numero;
}

export function inicioSemana(fecha: string) { const valor = new Date(`${fecha}T12:00:00`); valor.setDate(valor.getDate() - ((valor.getDay() + 6) % 7)); return valor.toISOString().slice(0, 10); }
