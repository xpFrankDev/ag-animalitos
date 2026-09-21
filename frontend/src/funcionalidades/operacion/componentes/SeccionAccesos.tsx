import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../../compartido/api/cliente';
import type { AccesoBloqueado, Avisar, ReportarError } from '../tipos';

type Propiedades = {
  token: string;
  alVencerSesion: () => void;
  avisar: Avisar;
  reportarError: ReportarError;
};

/** Sub módulo de accesos bloqueados: equipos y usuarios de la red o del grupo. */
export function SeccionAccesos({ token, alVencerSesion, avisar, reportarError }: Propiedades) {
  const { t } = useTranslation();
  const [accesos, establecerAccesos] = useState<AccesoBloqueado[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState('');

  const cargar = useCallback(async () => {
    establecerCargando(true);
    establecerError('');
    try {
      establecerAccesos(await llamarApi<AccesoBloqueado[]>('/operacion/accesos', {}, token));
    } catch (causa) {
      if (causa instanceof ErrorApi && causa.estado === 401) {
        alVencerSesion();
        return;
      }
      establecerError(causa instanceof Error ? causa.message : t('error_consulta'));
    } finally {
      establecerCargando(false);
    }
  }, [token, alVencerSesion, t]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function desbloquear(acceso: AccesoBloqueado) {
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/accesos/${acceso.pk_control_acceso}/desbloquear`, { method: 'POST' }, token);
      avisar(respuesta.mensaje);
      await cargar();
    } catch (causa) {
      reportarError(causa);
    }
  }

  return (
    <section className="tarjeta bloque-operacion">
      <header className="cabecera-bloque">
        <h2>{t('accesos')}</h2>
        <button type="button" className="boton-secundario" disabled={cargando} onClick={() => void cargar()}>
          {cargando ? t('actualizando') : t('actualizar')}
        </button>
      </header>
      {error ? (
        <p className="vacio-operacion mensaje-error">{error}</p>
      ) : accesos.length ? (
        <div className="tabla-operacion">
          {accesos.map((acceso) => (
            <div key={acceso.pk_control_acceso}>
              <span>
                <strong>
                  {acceso.tipo} · {acceso.clave}
                </strong>
                <small>
                  {acceso.permanente
                    ? t('bloqueo_permanente')
                    : acceso.vigente && acceso.bloqueado_hasta
                      ? t('bloqueo_hasta', { fecha: new Date(acceso.bloqueado_hasta).toLocaleString() })
                      : t('bloqueo_expirado')}{' '}
                  · {t('bloqueos_consecutivos', { cantidad: acceso.bloqueos_consecutivos })}
                </small>
              </span>
              <span className={acceso.vigente ? 'estado-inactivo' : 'estado-activo'}>
                {acceso.vigente ? t('inactivo') : t('activo')}
              </span>
              <div className="acciones-fila">
                <button type="button" className="boton-secundario" onClick={() => void desbloquear(acceso)}>
                  {t('desbloquear')}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="vacio-operacion">{cargando ? t('cargando') : t('sin_accesos')}</p>
      )}
    </section>
  );
}
