import { useTranslation } from 'react-i18next';
import { formatearMonto as monto } from '../../../compartido/utilidades/formato';
import type { Grupero } from '../tipos';

type Propiedades = {
  gruperos: Grupero[];
  alCrear: () => void;
  alEditar: (grupero: Grupero) => void;
  alClonar: (grupero: Grupero) => void;
  alDesactivar: (grupero: Grupero) => void;
};

/** Sub módulo de gruperos: alta, edición, clonado y baja dentro de la red del banquero. */
export function SeccionGruperos({ gruperos, alCrear, alEditar, alClonar, alDesactivar }: Propiedades) {
  const { t } = useTranslation();

  return (
    <section className="tarjeta bloque-operacion">
      <header className="cabecera-bloque">
        <h2>{t('gruperos')}</h2>
        <button type="button" className="boton-primario" onClick={alCrear}>
          {t('crear_grupero')}
        </button>
      </header>
      {gruperos.length ? (
        <div className="tabla-operacion">
          {gruperos.map((grupero) => (
            <div key={grupero.pk_grupero}>
              <span className="fila-principal">
                <span className="titulo-fila">
                  <strong>{grupero.nombre_completo}</strong>
                  <span className={grupero.activo ? 'estado-activo' : 'estado-inactivo'}>
                    {grupero.activo ? t('activo') : t('inactivo')}
                  </span>
                </span>
                <small>
                  {grupero.nombre_usuario} · {t('agencias_asignadas', { cantidad: grupero.agencias })} · {t('cupo')}{' '}
                  {grupero.cupo_animal.toFixed(2)} · {grupero.comision_porcentaje.toFixed(2)}%
                </small>
                <small>
                  {t('venta_grupo')} {monto(grupero.venta_grupo)} · {t('comision_grupo')} {monto(grupero.comision_grupo)}
                </small>
              </span>
              <div className="acciones-fila">
                <button type="button" className="boton-secundario" onClick={() => alEditar(grupero)}>
                  {t('editar')}
                </button>
                <button type="button" className="boton-secundario" onClick={() => alClonar(grupero)}>
                  {t('clonar')}
                </button>
                {grupero.activo && (
                  <button type="button" className="boton-peligro" onClick={() => alDesactivar(grupero)}>
                    {t('desactivar')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="vacio-operacion">{t('sin_gruperos')}</p>
      )}
    </section>
  );
}
