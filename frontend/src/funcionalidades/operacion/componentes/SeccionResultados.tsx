import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../../compartido/api/cliente';
import { fechaCaracas } from '../../../compartido/utilidades/formato';
import type { Avisar, Catalogo, PermisosOperacion, ReportarError, RespuestaResultados, ResultadoOperacion } from '../tipos';

type Propiedades = {
  token: string;
  permisos: PermisosOperacion;
  alVencerSesion: () => void;
  avisar: Avisar;
  reportarError: ReportarError;
};

const TODOS = 'todos';

/** Sub módulo de resultados: selección por día y filtro por tipo de sorteo. */
export function SeccionResultados({ token, permisos, alVencerSesion, avisar, reportarError }: Propiedades) {
  const { t } = useTranslation();
  const hoy = fechaCaracas();
  const [fecha, establecerFecha] = useState(hoy);
  const [fechaAplicada, establecerFechaAplicada] = useState(hoy);
  const [filtroSorteo, establecerFiltroSorteo] = useState(TODOS);
  const [resultados, establecerResultados] = useState<ResultadoOperacion[]>([]);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState('');

  const [catalogo, establecerCatalogo] = useState<Catalogo | null>(null);
  const [modal, establecerModal] = useState(false);
  const [fechaResultado, establecerFechaResultado] = useState(hoy);
  const [horario, establecerHorario] = useState('');
  const [animal, establecerAnimal] = useState('');
  const [guardando, establecerGuardando] = useState(false);

  const cargar = useCallback(
    async (fechaConsulta: string) => {
      establecerCargando(true);
      establecerError('');
      try {
        const respuesta = await llamarApi<RespuestaResultados>(`/operacion/resultados?fecha=${fechaConsulta}`, {}, token);
        establecerResultados(respuesta.resultados);
      } catch (causa) {
        if (causa instanceof ErrorApi && causa.estado === 401) {
          alVencerSesion();
          return;
        }
        establecerError(causa instanceof Error ? causa.message : t('error_consulta'));
      } finally {
        establecerCargando(false);
      }
    },
    [token, alVencerSesion, t],
  );

  useEffect(() => {
    void cargar(fechaAplicada);
  }, [cargar, fechaAplicada]);

  const tiposSorteo = useMemo(() => [...new Set(resultados.map((resultado) => resultado.sorteo))], [resultados]);

  useEffect(() => {
    if (filtroSorteo !== TODOS && !tiposSorteo.includes(filtroSorteo)) establecerFiltroSorteo(TODOS);
  }, [tiposSorteo, filtroSorteo]);

  const visibles = filtroSorteo === TODOS ? resultados : resultados.filter((resultado) => resultado.sorteo === filtroSorteo);

  /** El sorteo elegido trae su lista de animales: Guácharo Activo no comparte la de los clásicos. */
  const animalesDelHorario = useMemo(() => {
    const grupoId = catalogo?.horarios.find((item) => String(item.pk_horario_sorteo) === horario)?.fk_grupo_animales;
    const permitidos = catalogo?.grupos.find((grupo) => grupo.pk_grupo_animales === grupoId)?.animales;
    const animales = catalogo?.animales ?? [];
    if (!permitidos) return animales;
    const incluidos = new Set(permitidos);
    return animales.filter((item) => incluidos.has(item.pk_animal));
  }, [catalogo, horario]);

  useEffect(() => {
    if (!animalesDelHorario.length) return;
    if (!animalesDelHorario.some((item) => String(item.pk_animal) === animal)) establecerAnimal(String(animalesDelHorario[0].pk_animal));
  }, [animalesDelHorario, animal]);

  function buscar() {
    establecerFiltroSorteo(TODOS);
    establecerFechaAplicada(fecha);
    void cargar(fecha);
  }

  async function abrirRegistro() {
    try {
      const datos = await llamarApi<Catalogo>('/operacion/catalogo-resultados', {}, token);
      establecerCatalogo(datos);
      establecerFechaResultado(fechaAplicada);
      const primerHorario = datos.horarios[0];
      const primerGrupo = datos.grupos.find((grupo) => grupo.pk_grupo_animales === primerHorario?.fk_grupo_animales);
      const primerAnimal = datos.animales.find((item) => !primerGrupo || primerGrupo.animales.includes(item.pk_animal));
      establecerHorario(primerHorario ? String(primerHorario.pk_horario_sorteo) : '');
      establecerAnimal(primerAnimal ? String(primerAnimal.pk_animal) : '');
      establecerModal(true);
    } catch (causa) {
      reportarError(causa);
    }
  }

  async function guardarResultado(evento: FormEvent) {
    evento.preventDefault();
    if (!fechaResultado || !horario || !animal) {
      avisar(t('resultado_incompleto'));
      return;
    }
    establecerGuardando(true);
    try {
      await llamarApi<{ mensaje: string }>(
        '/operacion/resultados',
        {
          method: 'POST',
          body: JSON.stringify({
            fecha_juego: fechaResultado,
            fk_horario_sorteo: Number(horario),
            fk_animal: Number(animal),
          }),
        },
        token,
      );
      avisar(t('resultado_guardado'));
      establecerModal(false);
      establecerFecha(fechaResultado);
      establecerFechaAplicada(fechaResultado);
      establecerFiltroSorteo(TODOS);
      await cargar(fechaResultado);
    } catch (causa) {
      reportarError(causa);
    } finally {
      establecerGuardando(false);
    }
  }

  async function eliminarResultado(pkResultado: string) {
    if (!window.confirm(t('confirmar_eliminar_resultado'))) return;
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/resultados/${pkResultado}`, { method: 'DELETE' }, token);
      avisar(respuesta.mensaje);
      await cargar(fechaAplicada);
    } catch (causa) {
      reportarError(causa);
    }
  }

  return (
    <section className="tarjeta bloque-operacion">
      <header className="cabecera-bloque">
        <div>
          <h2>{t('ver_resultados')}</h2>
          <small className="rango-aplicado">
            {t('resultados_del_dia', { fecha: fechaAplicada, cantidad: visibles.length })}
          </small>
        </div>
        {permisos.puede_registrar_resultados && (
          <button type="button" className="boton-secundario" onClick={() => void abrirRegistro()}>
            {t('registrar_resultado')}
          </button>
        )}
      </header>

      <div className="controles-consulta controles-resultados">
        <label className="filtro-fecha">
          {t('fecha')}
          <input type="date" value={fecha} onChange={(evento) => establecerFecha(evento.target.value)} />
        </label>
        <div className="filtros-sorteos" role="group" aria-label={t('filtrar_sorteos')}>
          <button type="button" className={filtroSorteo === TODOS ? 'activo' : ''} onClick={() => establecerFiltroSorteo(TODOS)}>
            {t('todos')}
          </button>
          {tiposSorteo.map((sorteo) => (
            <button
              type="button"
              key={sorteo}
              className={filtroSorteo === sorteo ? 'activo' : ''}
              onClick={() => establecerFiltroSorteo(sorteo)}
            >
              {sorteo}
            </button>
          ))}
        </div>
        <button type="button" className="boton-buscar" disabled={cargando} onClick={buscar}>
          {cargando ? t('actualizando') : t('buscar')}
        </button>
      </div>

      {error ? (
        <p className="vacio-operacion mensaje-error">{error}</p>
      ) : visibles.length ? (
        <div className="tabla-resultados">
          {visibles.map((resultado) => (
            <div className="fila-resultado" key={resultado.pk_resultado}>
              <span className="hora-resultado">{resultado.hora}</span>
              <span className="sorteo-resultado">
                <strong>{resultado.sorteo}</strong>
                <small>{resultado.origen === 'AUTOMATICO' ? t('origen_automatico') : t('origen_manual')}</small>
              </span>
              <span className="animal-resultado">
                <b aria-hidden="true">{resultado.icono_animal}</b>
                <strong>{resultado.codigo_animal}</strong> {resultado.nombre_animal}
              </span>
              {permisos.puede_registrar_resultados && resultado.origen === 'MANUAL' && !resultado.aplicado ? (
                <button type="button" className="boton-peligro" onClick={() => void eliminarResultado(resultado.pk_resultado)}>
                  {t('eliminar')}
                </button>
              ) : (
                <span className={resultado.aplicado ? 'estado-activo' : 'estado-inactivo'}>
                  {resultado.aplicado ? t('aplicado') : t('pendiente')}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="vacio-operacion">{cargando ? t('cargando') : t('sin_resultados_fecha')}</p>
      )}

      {modal && (
        <div className="fondo-consulta">
          <form className="ventana-consulta tarjeta formulario-resultado" onSubmit={guardarResultado}>
            <header className="encabezado-consulta">
              <h2>{t('registrar_resultado')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerModal(false)}>
                ×
              </button>
            </header>
            <p className="aviso-operacion">{t('resultado_manual_aviso')}</p>
            <label>
              {t('fecha')}
              <input type="date" value={fechaResultado} onChange={(evento) => establecerFechaResultado(evento.target.value)} required />
            </label>
            <label>
              {t('sorteos')}
              <select value={horario} onChange={(evento) => establecerHorario(evento.target.value)} required>
                {catalogo?.horarios.map((item) => (
                  <option key={item.pk_horario_sorteo} value={item.pk_horario_sorteo}>
                    {item.sorteo} · {item.hora} · x{item.multiplicador_premio}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('animal_manual')}
              <select value={animal} onChange={(evento) => establecerAnimal(evento.target.value)} required>
                {animalesDelHorario.map((item) => (
                  <option key={item.pk_animal} value={item.pk_animal}>
                    {item.icono} {item.codigo_animal} · {item.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button className="boton-primario" disabled={guardando}>
              {guardando ? t('guardando') : t('guardar_resultado')}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
