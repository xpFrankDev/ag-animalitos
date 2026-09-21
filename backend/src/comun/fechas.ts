import { BadRequestException } from '@nestjs/common';

export const ZONA_HORARIA_POR_DEFECTO = 'America/Caracas';
const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Toda la operación (venta, cierre de sorteos, resultados y numeración de tickets)
 * se rige por la hora de Venezuela, aunque el servidor esté en otra zona horaria.
 */
export function zonaHorariaOperacion(): string {
  return process.env.ZONA_HORARIA ?? ZONA_HORARIA_POR_DEFECTO;
}

function partesEnZona(fecha: Date, zona: string): Record<string, string> {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  return Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
}

export function fechaEnZona(fecha: Date, zona: string = zonaHorariaOperacion()): string {
  const partes = partesEnZona(fecha, zona);
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** Fecha de juego vigente según la hora de Venezuela. */
export function fechaOperacion(fecha: Date = new Date()): string {
  return fechaEnZona(fecha);
}

export function esFechaValida(valor: string): boolean {
  if (!PATRON_FECHA.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const comprobacion = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    comprobacion.getUTCFullYear() === anio &&
    comprobacion.getUTCMonth() === mes - 1 &&
    comprobacion.getUTCDate() === dia
  );
}

/** Devuelve la fecha consultada o la fecha de juego actual, siempre validada. */
export function resolverFecha(valor?: string, ahora: Date = new Date()): string {
  if (valor === undefined || valor.trim() === '') return fechaOperacion(ahora);
  const fecha = valor.trim();
  if (!esFechaValida(fecha)) throw new BadRequestException('La fecha debe tener el formato AAAA-MM-DD.');
  return fecha;
}

/** Minutos transcurridos del día en la zona indicada (0 a 1439). */
export function minutosDelDia(fecha: Date, zona: string = zonaHorariaOperacion()): number {
  const partes = partesEnZona(fecha, zona);
  return Number(partes.hour) * 60 + Number(partes.minute);
}

/** Desfase de la zona respecto a UTC en un momento dado, por ejemplo `-04:00`. */
export function desfaseDeZona(fecha: Date, zona: string): string {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: zona, timeZoneName: 'longOffset' }).formatToParts(fecha);
  const valor = partes.find((parte) => parte.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const desfase = valor.replace('GMT', '');
  return desfase === '' || desfase === '+00:00' ? '+00:00' : desfase;
}

/**
 * Convierte una hora local de Venezuela en un instante real. Es la base para saber si un
 * sorteo ya cerró, aunque el servidor esté en otra zona horaria.
 */
export function instanteDeHoraLocal(fecha: string, hora: string, zona: string = zonaHorariaOperacion()): Date {
  const [horas, minutos] = hora.split(':');
  const desfase = desfaseDeZona(new Date(`${fecha}T12:00:00Z`), zona);
  return new Date(`${fecha}T${horas.padStart(2, '0')}:${(minutos ?? '00').padStart(2, '0')}:00${desfase}`);
}

/** Momento exacto en que un sorteo deja de venderse. */
export function cierreDeHorario(
  fechaJuego: string,
  hora: string,
  minutosCierre: number,
  zona: string = zonaHorariaOperacion(),
): Date {
  return new Date(instanteDeHoraLocal(fechaJuego, hora, zona).getTime() - minutosCierre * 60_000);
}

/**
 * Numera los tickets por jornada y por agencia: cada día el primer ticket vuelve a ser el 1.
 * `fecha_ultimo_numero_ticket` guarda a qué jornada corresponde el contador.
 */
export function numeroTicketDelDia(
  fechaUltimoNumeroTicket: string | null | undefined,
  proximoNumeroTicket: number,
  fechaJuego: string,
): number {
  if (fechaUltimoNumeroTicket === fechaJuego) return Math.max(1, proximoNumeroTicket);
  return 1;
}
