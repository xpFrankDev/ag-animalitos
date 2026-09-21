/** Redondeo monetario a dos decimales, evitando el arrastre de coma flotante. */
export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function sumarMontos(valores: Array<number | string>): number {
  return redondear2(valores.reduce<number>((total, valor) => total + Number(valor), 0));
}

export function multiplicarMonto(monto: number, factor: number): number {
  return redondear2(monto * factor);
}

/** Comisión variable: el banquero define el porcentaje de cada agencia. */
export function calcularComision(monto: number, porcentaje: number): number {
  return redondear2((monto * porcentaje) / 100);
}

export function aDecimal(valor: number): string {
  return redondear2(valor).toFixed(2);
}
