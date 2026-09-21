import { TipoControlAcceso } from '../base-datos/entidades';
import { aplicarIntentoFallido, construirAlcancesAcceso, limitesAcceso } from './control-acceso.service';

describe('control de acceso', () => {
  it('controla el intento por usuario, IP y equipo', () => {
    expect(construirAlcancesAcceso(' Agencia_Demo ', '190.1.1.5', 'ag-abc')).toEqual([
      { tipo: TipoControlAcceso.USUARIO, clave: 'agencia_demo' },
      { tipo: TipoControlAcceso.IP, clave: '190.1.1.5' },
      { tipo: TipoControlAcceso.EQUIPO, clave: 'ag-abc' },
    ]);
  });

  it('omite el equipo cuando no se informa', () => {
    expect(construirAlcancesAcceso('agencia', '190.1.1.5')).toHaveLength(2);
  });

  it('usa los límites por defecto acordados', () => {
    expect(limitesAcceso({})).toEqual({
      intentosPermitidos: 3,
      minutosBloqueo: 5,
      bloqueosAntesDeBloqueoPermanente: 3,
    });
  });

  it('permite ajustar los límites por entorno', () => {
    expect(
      limitesAcceso({
        ACCESO_INTENTOS_PERMITIDOS: '5',
        ACCESO_MINUTOS_BLOQUEO: '10',
        ACCESO_BLOQUEOS_ANTES_DE_BLOQUEO_PERMANENTE: '4',
      }),
    ).toMatchObject({
      intentosPermitidos: 5,
      minutosBloqueo: 10,
      bloqueosAntesDeBloqueoPermanente: 4,
    });
  });
});

describe('bloqueo por intentos fallidos', () => {
  const limites = limitesAcceso({});
  const ahora = new Date('2026-09-21T12:00:00.000Z');

  it('cuenta los intentos sin bloquear antes del límite', () => {
    expect(aplicarIntentoFallido({ intentos_fallidos: 0, bloqueos_consecutivos: 0 }, limites, ahora)).toEqual({
      intentos_fallidos: 1,
      bloqueos_consecutivos: 0,
      bloqueado_hasta: null,
      bloqueo_permanente: false,
    });
    expect(aplicarIntentoFallido({ intentos_fallidos: 1, bloqueos_consecutivos: 0 }, limites, ahora).intentos_fallidos).toBe(2);
  });

  it('al tercer intento bloquea 5 minutos', () => {
    const estado = aplicarIntentoFallido({ intentos_fallidos: 2, bloqueos_consecutivos: 0 }, limites, ahora);
    expect(estado.bloqueo_permanente).toBe(false);
    expect(estado.bloqueado_hasta?.toISOString()).toBe('2026-09-21T12:05:00.000Z');
    expect(estado.bloqueos_consecutivos).toBe(1);
    expect(estado.intentos_fallidos).toBe(0);
  });

  it('mantiene el bloqueo corto en el segundo bloqueo', () => {
    const estado = aplicarIntentoFallido({ intentos_fallidos: 2, bloqueos_consecutivos: 1 }, limites, ahora);
    expect(estado.bloqueo_permanente).toBe(false);
    expect(estado.bloqueado_hasta?.toISOString()).toBe('2026-09-21T12:05:00.000Z');
    expect(estado.bloqueos_consecutivos).toBe(2);
  });

  it('en el tercer bloqueo el acceso queda permanente', () => {
    const estado = aplicarIntentoFallido({ intentos_fallidos: 2, bloqueos_consecutivos: 2 }, limites, ahora);
    expect(estado.bloqueo_permanente).toBe(true);
    expect(estado.bloqueado_hasta).toBeNull();
    expect(estado.bloqueos_consecutivos).toBe(3);
  });
});
