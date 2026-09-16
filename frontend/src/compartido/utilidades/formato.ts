export function fechaCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
}

export function formatearMonto(valor: number | string): string {
  return `$${Number(valor).toFixed(2)}`;
}
