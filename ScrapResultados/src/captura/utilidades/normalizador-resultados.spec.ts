import { BadRequestException } from '@nestjs/common';
import { fechaEnZonaHoraria, normalizarCodigoAnimal, normalizarHora } from './normalizador-resultados';

describe('normalizadores de resultados', () => {
  it.each([['1', '1'], ['01', '1'], ['05', '5'], ['06', '6'], ['Animal 9', '9'], ['00', '00'], ['0', '0'], ['10', '10'], ['18', '18'], ['36 Tigre', '36']])('normaliza %s como %s', (entrada, esperado) => {
    expect(normalizarCodigoAnimal(entrada)).toBe(esperado);
  });

  it.each(Array.from({ length: 9 }, (_, indice) => indice + 1))('normaliza el código de un dígito %i con y sin cero a la izquierda', (numero) => {
    expect(normalizarCodigoAnimal(String(numero))).toBe(String(numero));
    expect(normalizarCodigoAnimal(String(numero).padStart(2, '0'))).toBe(String(numero));
  });

  it.each([['37', 'está fuera del rango'], ['99', 'está fuera del rango'], ['sin código', 'no tiene dígitos']])('rechaza «%s» cuando %s', (entrada) => {
    expect(() => normalizarCodigoAnimal(entrada)).toThrow(BadRequestException);
  });

  it.each([['8:00 AM', '08:00:00'], ['08:00 a.m.', '08:00:00'], ['12:30 PM', '12:30:00'], ['1:30 pm', '13:30:00'], ['18:30', '18:30:00']])('normaliza la hora %s', (entrada, esperado) => {
    expect(normalizarHora(entrada)).toBe(esperado);
  });

  it('genera una fecha ISO de la zona consultada', () => {
    expect(fechaEnZonaHoraria('America/Caracas')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
