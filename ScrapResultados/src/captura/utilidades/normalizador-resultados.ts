import { BadRequestException } from '@nestjs/common';

export function normalizarCodigoAnimal(valor: string): string {
  const coincidencia = valor.match(/\b(\d{1,2})\b/);
  if (!coincidencia) throw new BadRequestException(`No se encontró un código animal válido en «${valor}».`);
  const numero = Number(coincidencia[1]);
  if (!Number.isInteger(numero) || numero < 0 || numero > 36) throw new BadRequestException(`El código animal «${coincidencia[1]}» está fuera del rango 00-36.`);
  return String(numero).padStart(2, '0');
}

export function normalizarHora(valor: string): string {
  const texto = valor.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
  const coincidencia = texto.match(/\b(\d{1,2})\s*[:.]\s*(\d{2})\s*(A\.?M\.?|P\.?M\.?)?\b/);
  if (!coincidencia) throw new BadRequestException(`No se encontró una hora válida en «${valor}».`);

  let hora = Number(coincidencia[1]);
  const minuto = Number(coincidencia[2]);
  const meridiano = coincidencia[3]?.replaceAll('.', '');
  if (minuto > 59 || hora > 23 || hora === 0 && meridiano) throw new BadRequestException(`La hora «${valor}» no es válida.`);

  if (meridiano === 'AM') hora = hora === 12 ? 0 : hora;
  if (meridiano === 'PM') hora = hora === 12 ? 12 : hora + 12;
  if (hora > 23) throw new BadRequestException(`La hora «${valor}» no es válida.`);
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00`;
}

export function fechaEnZonaHoraria(zonaHoraria: string): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((parte) => parte.type === tipo)?.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}
