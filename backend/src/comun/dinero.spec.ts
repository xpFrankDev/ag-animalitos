import { calcularComision, multiplicarMonto, redondear2, sumarMontos } from './dinero';

describe('cálculos monetarios', () => {
  it('redondea a dos decimales sin arrastre binario', () => {
    expect(redondear2(0.1 + 0.2)).toBe(0.3);
    expect(redondear2(10.005)).toBe(10.01);
  });

  it('suma montos heterogéneos', () => {
    expect(sumarMontos(['10.50', 5, '0.25'])).toBe(15.75);
  });

  it('aplica el multiplicador del sorteo', () => {
    expect(multiplicarMonto(10, 30)).toBe(300);
    expect(multiplicarMonto(3.33, 30)).toBe(99.9);
    expect(multiplicarMonto(2, 45.5)).toBe(91);
  });

  it('calcula comisiones variables definidas por el banquero', () => {
    expect(calcularComision(1000, 12)).toBe(120);
    expect(calcularComision(1000, 7.5)).toBe(75);
    expect(calcularComision(333.33, 12.5)).toBe(41.67);
  });
});
