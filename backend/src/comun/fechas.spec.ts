import { cierreDeHorario, esFechaValida, fechaEnZona, fechaOperacion, instanteDeHoraLocal, minutosDelDia, numeroTicketDelDia, resolverFecha } from './fechas';

describe('fechas de operación', () => {
  it('calcula la fecha de juego en hora de Venezuela y no en UTC', () => {
    // 21:30 en Venezuela del 20/09 equivale a 01:30 UTC del 21/09.
    const momento = new Date('2026-09-21T01:30:00.000Z');
    expect(fechaEnZona(momento, 'America/Caracas')).toBe('2026-09-20');
    expect(fechaEnZona(momento, 'UTC')).toBe('2026-09-21');
  });

  it('resuelve la fecha de hoy cuando no se indica fecha', () => {
    const momento = new Date('2026-09-21T01:30:00.000Z');
    expect(resolverFecha(undefined, momento)).toBe(fechaOperacion(momento));
  });

  it('rechaza fechas con formato o día inválidos', () => {
    expect(esFechaValida('2026-09-20')).toBe(true);
    expect(esFechaValida('2026-09-31')).toBe(false);
    expect(esFechaValida('2026-02-30')).toBe(false);
    expect(esFechaValida('20-09-2026')).toBe(false);
    expect(() => resolverFecha('2026-13-01')).toThrow();
  });

  it('mide los minutos del día en la zona de operación', () => {
    const momento = new Date('2026-09-21T14:15:00.000Z'); // 10:15 en Venezuela
    expect(minutosDelDia(momento, 'America/Caracas')).toBe(10 * 60 + 15);
  });

  it('convierte la hora del sorteo en un instante de Venezuela', () => {
    // 08:00 en Venezuela es 12:00 UTC.
    expect(instanteDeHoraLocal('2026-09-20', '08:00').toISOString()).toBe('2026-09-20T12:00:00.000Z');
    // 19:00 en Venezuela es 23:00 UTC del mismo día.
    expect(instanteDeHoraLocal('2026-09-20', '19:00').toISOString()).toBe('2026-09-20T23:00:00.000Z');
  });

  it('calcula el cierre restando los minutos configurados', () => {
    expect(cierreDeHorario('2026-09-20', '08:00', 5).toISOString()).toBe('2026-09-20T11:55:00.000Z');
    // 00:10 en Venezuela son las 04:10 UTC; con 20 minutos de cierre, 03:50 UTC.
    expect(cierreDeHorario('2026-09-20', '00:10', 20).toISOString()).toBe('2026-09-20T03:50:00.000Z');
  });

  it('reinicia la numeración de tickets en cada jornada', () => {
    expect(numeroTicketDelDia('2026-09-19', 45, '2026-09-20')).toBe(1);
    expect(numeroTicketDelDia('2026-09-20', 45, '2026-09-20')).toBe(45);
    expect(numeroTicketDelDia(null, 7, '2026-09-20')).toBe(1);
    expect(numeroTicketDelDia('2026-09-20', 0, '2026-09-20')).toBe(1);
  });
});
