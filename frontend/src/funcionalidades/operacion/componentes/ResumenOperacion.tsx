import { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formatearMonto as monto } from '../../../compartido/utilidades/formato';
import type { Inicio, PermisosOperacion } from '../tipos';

type Propiedades = {
  resumen: Inicio['resumen'];
  permisos: PermisosOperacion;
  tipoUsuario: 'GRUPERO' | 'BANQUERO';
  rango: { desde: string; hasta: string };
  desde: string;
  hasta: string;
  cargando: boolean;
  alCambiarDesde: (valor: string) => void;
  alCambiarHasta: (valor: string) => void;
  alBuscar: (evento: FormEvent) => void;
};

/** Dashboard del panel: solo el resumen de la operación y su período. */
export function ResumenOperacion({
  resumen,
  permisos,
  tipoUsuario,
  rango,
  desde,
  hasta,
  cargando,
  alCambiarDesde,
  alCambiarHasta,
  alBuscar,
}: Propiedades) {
  const { t } = useTranslation();

  return (
    <section className="tarjeta bloque-operacion">
      <header className="cabecera-bloque">
        <div>
          <h2>{t('resumen_operacion')}</h2>
          <small className="rango-aplicado">{t('rango_aplicado', { desde: rango.desde, hasta: rango.hasta })}</small>
        </div>
      </header>

      <form className="filtros-rango filtros-operacion" onSubmit={alBuscar}>
        <label>
          {t('desde')}
          <input type="date" value={desde} max={hasta} onChange={(evento) => alCambiarDesde(evento.target.value)} required />
        </label>
        <label>
          {t('hasta')}
          <input type="date" value={hasta} min={desde} onChange={(evento) => alCambiarHasta(evento.target.value)} required />
        </label>
        <button className="boton-buscar" disabled={cargando}>
          {cargando ? t('actualizando') : t('buscar')}
        </button>
      </form>

      <section className="metricas-operacion" aria-label={t('resumen_operacion')}>
        <div>
          <span>{t('total_vendido')}</span>
          <strong>{monto(resumen.total_vendido)}</strong>
        </div>
        <div>
          <span>{t('total_premiado')}</span>
          <strong>{monto(resumen.total_premiado)}</strong>
        </div>
        {permisos.puede_definir_comision && (
          <div>
            <span>{t('comision_estimada')}</span>
            <strong>{monto(resumen.total_comision)}</strong>
          </div>
        )}
        <div>
          <span>{tipoUsuario === 'GRUPERO' ? t('tu_comision') : t('comision_gruperos')}</span>
          <strong>{monto(resumen.comision_gruperos)}</strong>
        </div>
        <div>
          <span>{t('resto')}</span>
          <strong>{monto(resumen.resto)}</strong>
        </div>
      </section>
    </section>
  );
}
