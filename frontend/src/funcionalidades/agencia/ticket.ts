import type { Animal, Horario, Jugada } from './ventas.tipos';
import { formatearCodigoAnimal, valorCodigoAnimal } from './utilidades';

/**
 * Composición de la tirilla que va a la impresora térmica de 58 mm.
 *
 * Sigue el formato de los recibos de taquilla: `numero-nombre reducido x monto`,
 * agrupado por sorteo y hora ascendente. Las jugadas de un mismo horario comparten
 * bloque y se reparten en líneas; cada animal distinto conserva su propia entrada.
 */
export type EtiquetasTicket = { monto: string; jugadas: string };

export type DatosTicket = {
  agencia: string;
  codigoAgencia: string;
  numeroTicket?: number;
  serial?: string;
  fecha?: Date;
  /** Líneas en blanco al final de la tirilla, configuradas por agencia. */
  saltosLinea?: number;
  jugadas: Jugada[];
  animales: Map<number, Animal>;
  horarios: Map<number, Horario>;
  etiquetas: EtiquetasTicket;
};

type BloqueTicket = { hora: string; sorteo: string; entradas: string[] };

/** Ancho útil de la tirilla a 9 pt: unas 32 columnas de fuente monoespaciada. */
const ANCHO_TIRILLA = 32;
const SEPARADOR = '-'.repeat(ANCHO_TIRILLA);

/** Nombre abreviado del animal para la tirilla: tres letras, sin acentos ni signos. */
export function reducirNombreAnimal(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase();
}

/** Fecha y hora de la tirilla en la zona de la operación, sin segundos. */
function fechaDeTicket(fecha: Date): string {
  const partes = new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valor = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';
  return `${valor('day')}/${valor('month')}/${valor('year')} ${valor('hour')}:${valor('minute')}`;
}

/** Reparte las entradas en líneas de tirilla sin partir ninguna jugada. */
function repartirEnLineas(entradas: string[], ancho = ANCHO_TIRILLA): string[] {
  const lineas: string[] = [];
  let actual = '';
  for (const entrada of entradas) {
    if (!actual) actual = entrada;
    else if (`${actual} ${entrada}`.length <= ancho) actual = `${actual} ${entrada}`;
    else {
      lineas.push(actual);
      actual = entrada;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Agrupa las jugadas por sorteo y hora, en orden ascendente de horario. */
function agruparPorHorario(datos: DatosTicket): BloqueTicket[] {
  const bloques = new Map<number, BloqueTicket>();
  for (const jugada of datos.jugadas) {
    const horario = datos.horarios.get(jugada.fk_horario_sorteo);
    const animal = datos.animales.get(jugada.fk_animal);
    if (!horario || !animal) continue;
    const bloque = bloques.get(jugada.fk_horario_sorteo) ?? { hora: horario.hora, sorteo: horario.sorteo, entradas: [] };
    bloque.entradas.push(`${formatearCodigoAnimal(animal.codigo_animal)}-${reducirNombreAnimal(animal.nombre)}x${jugada.monto.toFixed(2)}`);
    bloques.set(jugada.fk_horario_sorteo, bloque);
  }
  return [...bloques.values()]
    .map((bloque) => ({
      ...bloque,
      entradas: [...bloque.entradas].sort((primera, segunda) => valorCodigoAnimal(primera) - valorCodigoAnimal(segunda)),
    }))
    .sort((primero, segundo) => primero.hora.localeCompare(segundo.hora) || primero.sorteo.localeCompare(segundo.sorteo));
}

/** Texto final que se muestra en la vista previa y se envía a la impresora. */
export function componerTicket(datos: DatosTicket): string {
  const bloques = agruparPorHorario(datos);
  const total = datos.jugadas.reduce((acumulado, jugada) => acumulado + jugada.monto, 0);
  const referencia =
    datos.numeroTicket === undefined || !datos.serial ? 'TCK# --- SER# ---' : `TCK# ${datos.numeroTicket} SER# ${datos.serial}`;
  const lineas = [
    '>>> AG · ANIMALITOS <<<',
    `${datos.agencia} · ${datos.codigoAgencia}`,
    referencia,
    fechaDeTicket(datos.fecha ?? new Date()),
    SEPARADOR,
  ];
  for (const bloque of bloques) {
    lineas.push(`${bloque.sorteo} ${bloque.hora}`.slice(0, ANCHO_TIRILLA), ...repartirEnLineas(bloque.entradas), SEPARADOR);
  }
  const jugadas = bloques.reduce((suma, bloque) => suma + bloque.entradas.length, 0);
  lineas.push(`${datos.etiquetas.monto}: $${total.toFixed(2)} ${datos.etiquetas.jugadas}: ${jugadas}`);
  const saltos = Math.max(0, Math.trunc(datos.saltosLinea ?? 0));
  // Cada salto es una línea con espacio duro: el navegador no dibuja líneas totalmente
  // vacías al final, y la impresora necesita avanzar el papel esos renglones.
  if (saltos) lineas.push(...Array.from({ length: saltos }, () => '\u00A0'));
  return lineas.join('\n');
}
