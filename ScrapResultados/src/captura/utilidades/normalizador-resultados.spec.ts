import { fechaEnZonaHoraria, normalizarCodigoAnimal, normalizarHora } from './normalizador-resultados';

describe('normalizadores de resultados', () => {
  it.each([['1', '01'], ['01', '01'], ['Animal 9', '09'], ['36 Tigre', '36']])('normaliza %s como %s', (entrada, esperado) => {
    expect(normalizarCodigoAnimal(entrada)).toBe(esperado);
  });

  it.each([['8:00 AM', '08:00:00'], ['08:00 a.m.', '08:00:00'], ['12:30 PM', '12:30:00'], ['1:30 pm', '13:30:00'], ['18:30', '18:30:00']])('normaliza la hora %s', (entrada, esperado) => {
    expect(normalizarHora(entrada)).toBe(esperado);
  });

  it('genera una fecha ISO de la zona consultada', () => {
    expect(fechaEnZonaHoraria('America/Caracas')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
