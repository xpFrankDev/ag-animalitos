import { useTranslation } from 'react-i18next';
import type { Agencia, PermisosOperacion } from '../tipos';

type Propiedades = {
  agencias: Agencia[];
  permisos: PermisosOperacion;
  alCrear: () => void;
  alEditar: (agencia: Agencia) => void;
  alClonar: (agencia: Agencia) => void;
  alLiberar: (agencia: Agencia) => void;
  alDesactivar: (agencia: Agencia) => void;
};

/** Sub módulo de agencias: alta, edición, clonado, liberación de equipo y baja. */
export function SeccionAgencias({ agencias, permisos, alCrear, alEditar, alClonar, alLiberar, alDesactivar }: Propiedades) {
  const { t } = useTranslation();

  return (
    <section className="tarjeta bloque-operacion agencias-admin">
      <header className="cabecera-bloque">
        <div>
          <h2>{t('agencias')}</h2>
          <small className="rango-aplicado">{permisos.alcance === 'RED' ? t('alcance_red') : t('alcance_grupo')}</small>
        </div>
        <button type="button" className="boton-primario" onClick={alCrear}>
          {t('crear_agencia')}
        </button>
      </header>
      {agencias.length ? (
        <div className="tabla-operacion">
          {agencias.map((agencia) => (
            <div key={agencia.pk_agencia}>
              <span className="fila-principal">
                <span className="titulo-fila">
                  <strong>{agencia.nombre_agencia}</strong>
                  <span className={agencia.activa ? 'estado-activo' : 'estado-inactivo'}>
                    {agencia.activa ? t('activo') : t('inactivo')}
                  </span>
                </span>
                <small>
                  {agencia.codigo_agencia} · {agencia.operador} ·{' '}
                  {agencia.equipo_asignado ? `${t('equipo_asignado')}: ${agencia.equipo ?? ''}` : t('sin_equipo')} ·{' '}
                  {agencia.comision_porcentaje.toFixed(2)}%
                </small>
              </span>
              <div className="acciones-fila">
                <button type="button" className="boton-secundario" onClick={() => alEditar(agencia)}>
                  {t('editar')}
                </button>
                <button type="button" className="boton-secundario" onClick={() => alClonar(agencia)}>
                  {t('clonar')}
                </button>
                {agencia.equipo_asignado && (
                  <button type="button" className="boton-secundario" onClick={() => alLiberar(agencia)}>
                    {t('liberar_serial')}
                  </button>
                )}
                {agencia.activa && (
                  <button type="button" className="boton-peligro" onClick={() => alDesactivar(agencia)}>
                    {t('desactivar')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="vacio-operacion">{t('sin_agencias')}</p>
      )}
    </section>
  );
}
