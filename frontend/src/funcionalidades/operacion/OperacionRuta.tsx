import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';
import { formatearMonto as monto, fechaCaracas } from '../../compartido/utilidades/formato';
import type { AccesoBloqueado, Agencia, Catalogo, FormularioAgencia, FormularioGrupero, Grupero, Inicio, Vista } from './tipos';
import { formularioAgenciaVacio, formularioGruperoVacio } from './utilidades';

type Propiedades = { token: string; alVencerSesion: () => void };

const TAMANO_PAGINA = 25;

export function OperacionRuta({ token, alVencerSesion }: Propiedades) {
  const { t } = useTranslation();
  const hoy = fechaCaracas();
  const [inicio, establecerInicio] = useState<Inicio | null>(null);
  const [vista, establecerVista] = useState<Vista>('agencias');
  const [cargando, establecerCargando] = useState(true);
  const [mensaje, establecerMensaje] = useState('');
  const [desde, establecerDesde] = useState(hoy);
  const [hasta, establecerHasta] = useState(hoy);
  const [rangoAplicado, establecerRangoAplicado] = useState({ desde: hoy, hasta: hoy });
  const [pagina, establecerPagina] = useState(1);
  const [accesos, establecerAccesos] = useState<AccesoBloqueado[]>([]);
  const [cargandoAccesos, establecerCargandoAccesos] = useState(false);

  const [modalResultado, establecerModalResultado] = useState(false);
  const [catalogo, establecerCatalogo] = useState<Catalogo | null>(null);
  const [fecha, establecerFecha] = useState(hoy);
  const [horario, establecerHorario] = useState('');
  const [animal, establecerAnimal] = useState('');
  const [guardando, establecerGuardando] = useState(false);

  const [modalAgencia, establecerModalAgencia] = useState(false);
  const [agenciaEditando, establecerAgenciaEditando] = useState<Agencia | null>(null);
  const [formularioAgencia, establecerFormularioAgencia] = useState<FormularioAgencia>(formularioAgenciaVacio);
  const [guardandoAgencia, establecerGuardandoAgencia] = useState(false);

  const [modalGrupero, establecerModalGrupero] = useState(false);
  const [gruperoEditando, establecerGruperoEditando] = useState<Grupero | null>(null);
  const [formularioGrupero, establecerFormularioGrupero] = useState<FormularioGrupero>(formularioGruperoVacio);
  const [guardandoGrupero, establecerGuardandoGrupero] = useState(false);

  useEffect(() => {
    if (!mensaje) return undefined;
    const temporizador = window.setTimeout(() => establecerMensaje(''), 4_000);
    return () => window.clearTimeout(temporizador);
  }, [mensaje]);

  const gestionarError = useCallback(
    (error: unknown) => {
      if (error instanceof ErrorApi && error.estado === 401) {
        alVencerSesion();
        return;
      }
      establecerMensaje(error instanceof Error ? error.message : t('error_generico'));
    },
    [alVencerSesion, t],
  );

  const cargar = useCallback(
    async (rango = rangoAplicado) => {
      establecerCargando(true);
      try {
        establecerInicio(await llamarApi<Inicio>(`/operacion/inicio?${new URLSearchParams({ ...rango }).toString()}`, {}, token));
      } catch (error) {
        gestionarError(error);
      } finally {
        establecerCargando(false);
      }
    },
    [rangoAplicado, token, gestionarError],
  );

  const cargarPagina = useCallback(
    async (paginaSolicitada: number) => {
      try {
        const parametros = new URLSearchParams({ ...rangoAplicado, pagina: String(paginaSolicitada), tamano: String(TAMANO_PAGINA) });
        const respuesta = await llamarApi<Inicio>(`/operacion/inicio?${parametros.toString()}`, {}, token);
        establecerInicio((actual) =>
          actual && paginaSolicitada > 1
            ? { ...respuesta, tickets: [...actual.tickets, ...respuesta.tickets] }
            : respuesta,
        );
      } catch (error) {
        gestionarError(error);
      }
    },
    [rangoAplicado, token, gestionarError],
  );

  const cargarAccesos = useCallback(async () => {
    establecerCargandoAccesos(true);
    try {
      establecerAccesos(await llamarApi<AccesoBloqueado[]>('/operacion/accesos', {}, token));
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerCargandoAccesos(false);
    }
  }, [token, gestionarError]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (vista === 'accesos' && inicio?.permisos) void cargarAccesos();
  }, [vista, inicio?.permisos, cargarAccesos]);

  const permisos = inicio?.permisos;
  const titulo = inicio?.perfil.tipo_usuario === 'BANQUERO' ? t('panel_banquero') : t('panel_grupero');

  function buscarRango(evento: FormEvent) {
    evento.preventDefault();
    if (desde > hasta) {
      establecerMensaje(t('error_consulta'));
      return;
    }
    const rango = { desde, hasta };
    establecerRangoAplicado(rango);
    establecerPagina(1);
    void cargar(rango);
  }

  async function abrirResultado() {
    try {
      const datos = await llamarApi<Catalogo>('/operacion/catalogo-resultados', {}, token);
      establecerCatalogo(datos);
      establecerHorario(datos.horarios[0] ? String(datos.horarios[0].pk_horario_sorteo) : '');
      establecerAnimal(datos.animales[0] ? String(datos.animales[0].pk_animal) : '');
      establecerModalResultado(true);
    } catch (error) {
      gestionarError(error);
    }
  }

  async function guardarResultado(evento: FormEvent) {
    evento.preventDefault();
    if (!fecha || !horario || !animal) {
      establecerMensaje(t('resultado_incompleto'));
      return;
    }
    establecerGuardando(true);
    try {
      await llamarApi<{ mensaje: string }>(
        '/operacion/resultados',
        { method: 'POST', body: JSON.stringify({ fecha_juego: fecha, fk_horario_sorteo: Number(horario), fk_animal: Number(animal) }) },
        token,
      );
      establecerMensaje(t('resultado_guardado'));
      establecerModalResultado(false);
      await cargar();
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerGuardando(false);
    }
  }

  async function liberarEquipo(pkAgencia: string) {
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/agencias/${pkAgencia}/liberar-serial`, { method: 'POST' }, token);
      establecerMensaje(respuesta.mensaje);
      await cargar();
    } catch (error) {
      gestionarError(error);
    }
  }

  async function desbloquearAcceso(pkControl: string) {
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/accesos/${pkControl}/desbloquear`, { method: 'POST' }, token);
      establecerMensaje(respuesta.mensaje);
      await cargarAccesos();
    } catch (error) {
      gestionarError(error);
    }
  }

  async function eliminarResultado(pkResultado: string) {
    if (!window.confirm(t('confirmar_eliminar_resultado'))) return;
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/resultados/${pkResultado}`, { method: 'DELETE' }, token);
      establecerMensaje(respuesta.mensaje);
      await cargar();
    } catch (error) {
      gestionarError(error);
    }
  }

  function abrirAgencia(agencia?: Agencia) {
    establecerAgenciaEditando(agencia ?? null);
    establecerFormularioAgencia(
      agencia
        ? {
            codigo_agencia: agencia.codigo_agencia,
            nombre_agencia: agencia.nombre_agencia,
            nombre_usuario: agencia.operador,
            contrasena: '',
            comision_porcentaje: String(agencia.comision_porcentaje ?? 12),
            cupo_animal: String(agencia.cupo_animal ?? 100),
            jugada_minima: String(agencia.jugada_minima ?? 1),
            minutos_cierre: String(agencia.minutos_cierre ?? 5),
            fk_grupero: agencia.grupero ?? '',
            activa: agencia.activa,
          }
        : formularioAgenciaVacio(),
    );
    establecerModalAgencia(true);
  }

  function abrirGrupero(grupero?: Grupero) {
    establecerGruperoEditando(grupero ?? null);
    establecerFormularioGrupero(
      grupero
        ? {
            nombre_completo: grupero.nombre_completo,
            nombre_usuario: grupero.nombre_usuario,
            contrasena: '',
            cupo_animal: String(grupero.cupo_animal ?? 500),
            comision_porcentaje: String(grupero.comision_porcentaje ?? 3),
            activo: grupero.activo,
          }
        : formularioGruperoVacio(),
    );
    establecerModalGrupero(true);
  }

  function cambiarCampoAgencia(campo: keyof FormularioAgencia, valor: string | boolean) {
    establecerFormularioAgencia((actual) => ({ ...actual, [campo]: valor }));
  }

  function cambiarCampoGrupero(campo: keyof FormularioGrupero, valor: string | boolean) {
    establecerFormularioGrupero((actual) => ({ ...actual, [campo]: valor }));
  }

  async function guardarAgencia(evento: FormEvent) {
    evento.preventDefault();
    const datos = {
      nombre_agencia: formularioAgencia.nombre_agencia,
      cupo_animal: Number(formularioAgencia.cupo_animal),
      jugada_minima: Number(formularioAgencia.jugada_minima),
      minutos_cierre: Number(formularioAgencia.minutos_cierre),
      activa: formularioAgencia.activa,
      ...(permisos?.puede_definir_comision ? { comision_porcentaje: Number(formularioAgencia.comision_porcentaje) } : {}),
      ...(permisos?.puede_gestionar_gruperos ? { fk_grupero: formularioAgencia.fk_grupero || undefined } : {}),
    };
    if (!agenciaEditando && (!formularioAgencia.codigo_agencia || !formularioAgencia.nombre_usuario || !formularioAgencia.contrasena)) {
      establecerMensaje(t('completar_agencia'));
      return;
    }
    establecerGuardandoAgencia(true);
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(
        agenciaEditando ? `/operacion/agencias/${agenciaEditando.pk_agencia}` : '/operacion/agencias',
        {
          method: agenciaEditando ? 'PATCH' : 'POST',
          body: JSON.stringify(
            agenciaEditando
              ? datos
              : {
                  ...datos,
                  codigo_agencia: formularioAgencia.codigo_agencia,
                  nombre_usuario: formularioAgencia.nombre_usuario,
                  contrasena: formularioAgencia.contrasena,
                },
          ),
        },
        token,
      );
      establecerMensaje(respuesta.mensaje);
      establecerModalAgencia(false);
      await cargar();
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerGuardandoAgencia(false);
    }
  }

  async function guardarGrupero(evento: FormEvent) {
    evento.preventDefault();
    if (!gruperoEditando && (!formularioGrupero.nombre_completo || !formularioGrupero.nombre_usuario || !formularioGrupero.contrasena)) {
      establecerMensaje(t('completar_grupero'));
      return;
    }
    establecerGuardandoGrupero(true);
    try {
      const cuerpo = gruperoEditando
        ? {
            nombre_completo: formularioGrupero.nombre_completo,
            cupo_animal: Number(formularioGrupero.cupo_animal),
            comision_porcentaje: Number(formularioGrupero.comision_porcentaje),
            activo: formularioGrupero.activo,
          }
        : {
            nombre_completo: formularioGrupero.nombre_completo,
            nombre_usuario: formularioGrupero.nombre_usuario,
            contrasena: formularioGrupero.contrasena,
            cupo_animal: Number(formularioGrupero.cupo_animal),
            comision_porcentaje: Number(formularioGrupero.comision_porcentaje),
          };
      const respuesta = await llamarApi<{ mensaje: string }>(
        gruperoEditando ? `/operacion/gruperos/${gruperoEditando.pk_grupero}` : '/operacion/gruperos',
        { method: gruperoEditando ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) },
        token,
      );
      establecerMensaje(respuesta.mensaje);
      establecerModalGrupero(false);
      await cargar();
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerGuardandoGrupero(false);
    }
  }

  async function desactivarAgencia(agencia: Agencia) {
    if (!window.confirm(t('confirmar_desactivar_agencia', { nombre: agencia.nombre_agencia }))) return;
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/agencias/${agencia.pk_agencia}`, { method: 'DELETE' }, token);
      establecerMensaje(respuesta.mensaje);
      await cargar();
    } catch (error) {
      gestionarError(error);
    }
  }

  async function desactivarGrupero(grupero: Grupero) {
    if (!window.confirm(t('confirmar_desactivar_grupero', { nombre: grupero.nombre_completo }))) return;
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/gruperos/${grupero.pk_grupero}`, { method: 'DELETE' }, token);
      establecerMensaje(respuesta.mensaje);
      await cargar();
    } catch (error) {
      gestionarError(error);
    }
  }

  if (cargando && !inicio) return <p className="estado-pagina">{t('cargando')}</p>;
  if (!inicio) return <p className="estado-pagina mensaje-error">{mensaje || t('error_consulta')}</p>;

  return (
    <section className="operacion">
      <header className="encabezado-operacion">
        <div>
          <h1>{titulo}</h1>
          <p>{inicio.perfil.nombre_completo}</p>
        </div>
        <span>
          {inicio.resumen.agencias} {t('agencias')}
        </span>
      </header>

      <form className="filtros-rango filtros-operacion" onSubmit={buscarRango}>
        <label>
          {t('desde')}
          <input type="date" value={desde} onChange={(evento) => establecerDesde(evento.target.value)} required />
        </label>
        <label>
          {t('hasta')}
          <input type="date" value={hasta} onChange={(evento) => establecerHasta(evento.target.value)} required />
        </label>
        <button className="boton-secundario" disabled={cargando}>
          {cargando ? t('actualizando') : t('buscar')}
        </button>
      </form>

      <section className="metricas-operacion" aria-label={t('resumen_operacion')}>
        <div>
          <span>{t('total_vendido')}</span>
          <strong>{monto(inicio.resumen.total_vendido)}</strong>
        </div>
        <div>
          <span>{t('total_premiado')}</span>
          <strong>{monto(inicio.resumen.total_premiado)}</strong>
        </div>
        {permisos?.puede_definir_comision && (
          <div>
            <span>{t('comision_estimada')}</span>
            <strong>{monto(inicio.resumen.total_comision)}</strong>
          </div>
        )}
        <div>
          <span>{inicio.perfil.tipo_usuario === 'GRUPERO' ? t('tu_comision') : t('comision_gruperos')}</span>
          <strong>{monto(inicio.resumen.comision_gruperos)}</strong>
        </div>
        <div>
          <span>{t('resto')}</span>
          <strong>{monto(inicio.resumen.resto)}</strong>
        </div>
      </section>

      <nav className="pestanas-operacion" aria-label={t('pestanas')}>
        <button type="button" className={vista === 'agencias' ? 'activo' : ''} onClick={() => establecerVista('agencias')}>
          {t('agencias')}
        </button>
        <button type="button" className={vista === 'tickets' ? 'activo' : ''} onClick={() => establecerVista('tickets')}>
          {t('listado_tickets')}
        </button>
        <button type="button" className={vista === 'resultados' ? 'activo' : ''} onClick={() => establecerVista('resultados')}>
          {t('ver_resultados')}
        </button>
        <button type="button" className={vista === 'accesos' ? 'activo' : ''} onClick={() => establecerVista('accesos')}>
          {t('accesos')}
        </button>
      </nav>

      {vista === 'agencias' && (
        <div className="tablero-operacion">
          {permisos?.puede_gestionar_gruperos && (
            <section className="tarjeta bloque-operacion">
              <header className="cabecera-bloque">
                <h2>{t('gruperos')}</h2>
                <button type="button" className="boton-primario" onClick={() => abrirGrupero()}>
                  {t('crear_grupero')}
                </button>
              </header>
              {inicio.gruperos.length ? (
                <div className="tabla-operacion">
                  {inicio.gruperos.map((grupero) => (
                    <div key={grupero.pk_grupero}>
                      <span>
                        <strong>{grupero.nombre_completo}</strong>
                        <small>
                          {grupero.nombre_usuario} · {t('agencias_asignadas', { cantidad: grupero.agencias })} · {t('cupo')}{' '}
                          {grupero.cupo_animal.toFixed(2)} · {grupero.comision_porcentaje.toFixed(2)}%
                        </small>
                        <small>
                          {t('venta_grupo')} {monto(grupero.venta_grupo)} · {t('comision_grupo')} {monto(grupero.comision_grupo)}
                        </small>
                      </span>
                      <span className={grupero.activo ? 'estado-activo' : 'estado-inactivo'}>
                        {grupero.activo ? t('activo') : t('inactivo')}
                      </span>
                      <div className="acciones-fila">
                        <button type="button" className="boton-secundario" onClick={() => abrirGrupero(grupero)}>
                          {t('editar')}
                        </button>
                        {grupero.activo && (
                          <button type="button" className="boton-peligro" onClick={() => void desactivarGrupero(grupero)}>
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
          )}
          <section className="tarjeta bloque-operacion agencias-admin">
            <header className="cabecera-bloque">
              <h2>{t('agencias')}</h2>
              <button type="button" className="boton-primario" onClick={() => abrirAgencia()}>
                {t('crear_agencia')}
              </button>
            </header>
            {inicio.agencias.length ? (
              <div className="tabla-operacion">
                {inicio.agencias.map((agencia) => (
                  <div key={agencia.pk_agencia}>
                    <span>
                      <strong>{agencia.nombre_agencia}</strong>
                      <small>
                        {agencia.codigo_agencia} · {agencia.operador} ·{' '}
                        {agencia.equipo_asignado ? `${t('equipo_asignado')}: ${agencia.equipo ?? ''}` : t('sin_equipo')} ·{' '}
                        {agencia.comision_porcentaje.toFixed(2)}%
                      </small>
                    </span>
                    <span className={agencia.activa ? 'estado-activo' : 'estado-inactivo'}>
                      {agencia.activa ? t('activo') : t('inactivo')}
                    </span>
                    <div className="acciones-fila">
                      <button type="button" className="boton-secundario" onClick={() => abrirAgencia(agencia)}>
                        {t('editar')}
                      </button>
                      {agencia.equipo_asignado && (
                        <button type="button" className="boton-secundario" onClick={() => void liberarEquipo(agencia.pk_agencia)}>
                          {t('liberar_equipo')}
                        </button>
                      )}
                      {agencia.activa && (
                        <button type="button" className="boton-peligro" onClick={() => void desactivarAgencia(agencia)}>
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
        </div>
      )}

      {vista === 'tickets' && (
        <section className="tarjeta bloque-operacion">
          <h2>{t('listado_tickets')}</h2>
          {inicio.tickets.length ? (
            <>
              <div className="tabla-operacion">
                {inicio.tickets.map((ticket) => (
                  <div key={ticket.serial}>
                    <span>
                      <strong>
                        #{ticket.numero_ticket} · {ticket.agencia}
                      </strong>
                      <small>
                        {ticket.fecha_juego} · {ticket.serial}
                      </small>
                    </span>
                    <span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>
                      {t(`estado_${ticket.estado.toLowerCase()}`)}
                    </span>
                    <strong>{monto(ticket.total_jugado)}</strong>
                  </div>
                ))}
              </div>
              <div className="pie-lista">
                <span>{t('total_mostrado', { mostrados: inicio.tickets.length, total: inicio.paginacion.total })}</span>
                {inicio.paginacion.tiene_mas && (
                  <button
                    type="button"
                    className="boton-secundario"
                    onClick={() => {
                      const siguiente = pagina + 1;
                      establecerPagina(siguiente);
                      void cargarPagina(siguiente);
                    }}
                  >
                    {t('cargar_mas')}
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="vacio-operacion">{t('sin_tickets')}</p>
          )}
        </section>
      )}

      {vista === 'resultados' && (
        <section className="tarjeta bloque-operacion">
          <header className="cabecera-bloque">
            <h2>{t('ver_resultados')}</h2>
            {permisos?.puede_registrar_resultados && (
              <button type="button" className="boton-secundario" onClick={() => void abrirResultado()}>
                {t('registrar_resultado')}
              </button>
            )}
          </header>
          {inicio.resultados.length ? (
            <div className="tabla-operacion">
              {inicio.resultados.map((resultado) => (
                <div key={resultado.pk_resultado}>
                  <span>
                    <strong>
                      {resultado.sorteo} · {resultado.hora}
                    </strong>
                    <small>
                      {resultado.fecha_juego} · {resultado.origen === 'AUTOMATICO' ? t('origen_automatico') : t('origen_manual')}
                    </small>
                  </span>
                  <strong>
                    {resultado.icono_animal} {resultado.codigo_animal} · {resultado.nombre_animal}
                  </strong>
                  {permisos?.puede_registrar_resultados && resultado.origen === 'MANUAL' && !resultado.aplicado && (
                    <div className="acciones-fila">
                      <button type="button" className="boton-peligro" onClick={() => void eliminarResultado(resultado.pk_resultado)}>
                        {t('eliminar')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="vacio-operacion">{t('sin_resultados')}</p>
          )}
        </section>
      )}

      {vista === 'accesos' && (
        <section className="tarjeta bloque-operacion">
          <header className="cabecera-bloque">
            <h2>{t('accesos')}</h2>
            <button type="button" className="boton-secundario" disabled={cargandoAccesos} onClick={() => void cargarAccesos()}>
              {cargandoAccesos ? t('actualizando') : t('actualizar')}
            </button>
          </header>
          {accesos.length ? (
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
                    <button type="button" className="boton-secundario" onClick={() => void desbloquearAcceso(acceso.pk_control_acceso)}>
                      {t('desbloquear')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="vacio-operacion">{t('sin_accesos')}</p>
          )}
        </section>
      )}

      {mensaje && (
        <p className="notificacion emergente" role="status">
          {mensaje}
        </p>
      )}

      {modalResultado && (
        <div className="fondo-consulta">
          <form className="ventana-consulta tarjeta formulario-resultado" onSubmit={guardarResultado}>
            <header className="encabezado-consulta">
              <h2>{t('registrar_resultado')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerModalResultado(false)}>
                ×
              </button>
            </header>
            <p className="aviso-operacion">{t('resultado_manual_aviso')}</p>
            <label>
              {t('fecha')}
              <input type="date" value={fecha} onChange={(evento) => establecerFecha(evento.target.value)} required />
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
                {catalogo?.animales.map((item) => (
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

      {modalAgencia && (
        <div className="fondo-consulta">
          <form className="ventana-consulta tarjeta formulario-agencia" onSubmit={guardarAgencia}>
            <header className="encabezado-consulta">
              <h2>{agenciaEditando ? t('editar_agencia') : t('crear_agencia')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerModalAgencia(false)}>
                ×
              </button>
            </header>
            <div className="campos-agencia">
              {!agenciaEditando && (
                <>
                  <label>
                    {t('codigo_agencia')}
                    <input
                      value={formularioAgencia.codigo_agencia}
                      onChange={(evento) => cambiarCampoAgencia('codigo_agencia', evento.target.value.toUpperCase())}
                      placeholder="AG-002"
                      required
                    />
                  </label>
                  <label>
                    {t('usuario_acceso')}
                    <input
                      value={formularioAgencia.nombre_usuario}
                      onChange={(evento) => cambiarCampoAgencia('nombre_usuario', evento.target.value)}
                      autoComplete="username"
                      required
                    />
                  </label>
                  <label>
                    {t('contrasena_inicial')}
                    <input
                      type="password"
                      value={formularioAgencia.contrasena}
                      onChange={(evento) => cambiarCampoAgencia('contrasena', evento.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </label>
                </>
              )}
              <label>
                {t('nombre_agencia')}
                <input value={formularioAgencia.nombre_agencia} onChange={(evento) => cambiarCampoAgencia('nombre_agencia', evento.target.value)} required />
              </label>
              {permisos?.puede_definir_comision ? (
                <label>
                  {t('comision_porcentaje')}
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step=".001"
                    value={formularioAgencia.comision_porcentaje}
                    onChange={(evento) => cambiarCampoAgencia('comision_porcentaje', evento.target.value)}
                    required
                  />
                </label>
              ) : (
                <p className="aviso-operacion">
                  {t('comision_porcentaje')}: {formularioAgencia.comision_porcentaje}% · {t('comision_solo_banquero')}
                </p>
              )}
              <label>
                {t('cupo_animal')}
                <input
                  type="number"
                  min="1"
                  step=".01"
                  value={formularioAgencia.cupo_animal}
                  onChange={(evento) => cambiarCampoAgencia('cupo_animal', evento.target.value)}
                  required
                />
              </label>
              <label>
                {t('jugada_minima')}
                <input
                  type="number"
                  min="1"
                  step=".01"
                  value={formularioAgencia.jugada_minima}
                  onChange={(evento) => cambiarCampoAgencia('jugada_minima', evento.target.value)}
                  required
                />
              </label>
              <label>
                {t('minutos_cierre')}
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={formularioAgencia.minutos_cierre}
                  onChange={(evento) => cambiarCampoAgencia('minutos_cierre', evento.target.value)}
                  required
                />
              </label>
              {permisos?.puede_gestionar_gruperos && (
                <label>
                  {t('grupero_asignado')}
                  <select value={formularioAgencia.fk_grupero} onChange={(evento) => cambiarCampoAgencia('fk_grupero', evento.target.value)}>
                    <option value="">{t('sin_grupero')}</option>
                    {inicio.gruperos
                      .filter((grupero) => grupero.activo)
                      .map((grupero) => (
                        <option key={grupero.pk_grupero} value={grupero.pk_grupero}>
                          {grupero.nombre_completo}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {agenciaEditando && (
                <label className="campo-check">
                  <input
                    type="checkbox"
                    checked={formularioAgencia.activa}
                    onChange={(evento) => cambiarCampoAgencia('activa', evento.target.checked)}
                  />{' '}
                  {t('agencia_activa')}
                </label>
              )}
            </div>
            <div className="acciones-modal">
              <button type="button" className="boton-secundario" onClick={() => establecerModalAgencia(false)}>
                {t('cancelar')}
              </button>
              <button className="boton-primario" disabled={guardandoAgencia}>
                {guardandoAgencia ? t('guardando') : agenciaEditando ? t('guardar_cambios') : t('crear_agencia')}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalGrupero && (
        <div className="fondo-consulta">
          <form className="ventana-consulta tarjeta formulario-agencia" onSubmit={guardarGrupero}>
            <header className="encabezado-consulta">
              <h2>{gruperoEditando ? t('editar_grupero') : t('crear_grupero')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerModalGrupero(false)}>
                ×
              </button>
            </header>
            <div className="campos-agencia">
              <label>
                {t('nombre_completo')}
                <input
                  value={formularioGrupero.nombre_completo}
                  onChange={(evento) => cambiarCampoGrupero('nombre_completo', evento.target.value)}
                  required
                />
              </label>
              {!gruperoEditando && (
                <>
                  <label>
                    {t('usuario_grupero')}
                    <input
                      value={formularioGrupero.nombre_usuario}
                      onChange={(evento) => cambiarCampoGrupero('nombre_usuario', evento.target.value)}
                      autoComplete="username"
                      required
                    />
                  </label>
                  <label>
                    {t('contrasena_inicial')}
                    <input
                      type="password"
                      value={formularioGrupero.contrasena}
                      onChange={(evento) => cambiarCampoGrupero('contrasena', evento.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                  </label>
                </>
              )}
              <label>
                {t('cupo_animal')}
                <input
                  type="number"
                  min="1"
                  step=".01"
                  value={formularioGrupero.cupo_animal}
                  onChange={(evento) => cambiarCampoGrupero('cupo_animal', evento.target.value)}
                  required
                />
              </label>
              <label>
                {t('comision_porcentaje')}
                <input
                  type="number"
                  min="0"
                  max="100"
                  step=".001"
                  value={formularioGrupero.comision_porcentaje}
                  onChange={(evento) => cambiarCampoGrupero('comision_porcentaje', evento.target.value)}
                  required
                />
              </label>
              {gruperoEditando && (
                <label className="campo-check">
                  <input type="checkbox" checked={formularioGrupero.activo} onChange={(evento) => cambiarCampoGrupero('activo', evento.target.checked)} />{' '}
                  {t('activo')}
                </label>
              )}
            </div>
            <div className="acciones-modal">
              <button type="button" className="boton-secundario" onClick={() => establecerModalGrupero(false)}>
                {t('cancelar')}
              </button>
              <button className="boton-primario" disabled={guardandoGrupero}>
                {guardandoGrupero ? t('guardando') : gruperoEditando ? t('guardar_cambios') : t('crear_grupero')}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
