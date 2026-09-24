import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';
import { NumeroAnimado } from '../../compartido/componentes/NumeroAnimado';
import { fechaCaracas, formatearMonto } from '../../compartido/utilidades/formato';
import type { Pagina } from './ventas.tipos';
import type { Resultado, Resumen, Ticket, VistaConsulta } from './consulta.tipos';
import { inicioSemana } from './utilidades';

type Propiedades = { token: string; vista: VistaConsulta; alCerrar: () => void; alVencerSesion: () => void };

const TAMANO_PAGINA = 25;

export function ConsultaAgenciaRuta({ token, vista, alCerrar, alVencerSesion }: Propiedades) {
  const { t } = useTranslation();
  const fechaHoy = useMemo(fechaCaracas, []);
  const [fechaResultados, establecerFechaResultados] = useState(fechaHoy);
  const [fechaResultadosAplicada, establecerFechaResultadosAplicada] = useState(fechaHoy);
  const [estado, establecerEstado] = useState('');
  const [desdeTickets, establecerDesdeTickets] = useState(() => inicioSemana(fechaHoy));
  const [hastaTickets, establecerHastaTickets] = useState(fechaHoy);
  const [filtroTicketsAplicado, establecerFiltroTicketsAplicado] = useState(() => ({
    estado: '',
    desde: inicioSemana(fechaHoy),
    hasta: fechaHoy,
  }));
  const [pagina, establecerPagina] = useState(1);
  const [desdeResumen, establecerDesdeResumen] = useState(() => inicioSemana(fechaHoy));
  const [hastaResumen, establecerHastaResumen] = useState(fechaHoy);
  const [rangoResumenAplicado, establecerRangoResumenAplicado] = useState(() => ({
    desde: inicioSemana(fechaHoy),
    hasta: fechaHoy,
  }));
  const [resultados, establecerResultados] = useState<Resultado[]>([]);
  const [tickets, establecerTickets] = useState<Ticket[]>([]);
  const [totalTickets, establecerTotalTickets] = useState(0);
  const [resumen, establecerResumen] = useState<Resumen | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [buscando, establecerBuscando] = useState(false);
  const [error, establecerError] = useState('');
  const [versionResultados, establecerVersionResultados] = useState(0);
  const [filtroResultado, establecerFiltroResultado] = useState('todos');
  const [ticketSeleccionado, establecerTicketSeleccionado] = useState('');

  const cargar = useCallback(
    async (paginaSolicitada: number) => {
      try {
        if (vista === 'resultados') {
          establecerResultados(await llamarApi<Resultado[]>(`/agencia/resultados?fecha=${fechaResultadosAplicada}`, {}, token));
        }
        if (vista === 'tickets') {
          const parametros = new URLSearchParams({
            desde: filtroTicketsAplicado.desde,
            hasta: filtroTicketsAplicado.hasta,
            pagina: String(paginaSolicitada),
            tamano: String(TAMANO_PAGINA),
          });
          if (filtroTicketsAplicado.estado) parametros.set('estado', filtroTicketsAplicado.estado);
          const respuesta = await llamarApi<Pagina<Ticket>>(`/agencia/tickets?${parametros.toString()}`, {}, token);
          establecerTickets((actuales) => (paginaSolicitada === 1 ? respuesta.items : [...actuales, ...respuesta.items]));
          establecerTotalTickets(respuesta.total);
          if (paginaSolicitada === 1) establecerTicketSeleccionado(respuesta.items[0]?.serial ?? '');
        }
        if (vista === 'resumen') {
          establecerResumen(
            await llamarApi<Resumen>(
              `/agencia/resumen-ventas?desde=${rangoResumenAplicado.desde}&hasta=${rangoResumenAplicado.hasta}`,
              {},
              token,
            ),
          );
        }
      } catch (causa) {
        if (causa instanceof ErrorApi && causa.estado === 401) {
          alVencerSesion();
          return;
        }
        establecerError(causa instanceof Error ? causa.message : t('error_consulta'));
      } finally {
        establecerCargando(false);
        establecerBuscando(false);
      }
    },
    [vista, token, fechaResultadosAplicada, filtroTicketsAplicado, rangoResumenAplicado, alVencerSesion, t],
  );

  useEffect(() => {
    void cargar(pagina);
  }, [cargar, pagina, versionResultados]);

  const etiquetaEstado = (valor: Ticket['estado']) => t(`estado_${valor.toLowerCase()}`);
  const titulo = vista === 'resultados' ? t('ver_resultados') : vista === 'tickets' ? t('listado_tickets') : t('resumen_ventas');

  const buscar = () => {
    establecerBuscando(true);
    establecerError('');
    if (vista === 'resultados') {
      establecerFechaResultadosAplicada(fechaResultados);
      establecerVersionResultados((actual) => actual + 1);
    }
    if (vista === 'tickets') {
      establecerTickets([]);
      establecerTotalTickets(0);
      establecerPagina(1);
      establecerFiltroTicketsAplicado({ estado, desde: desdeTickets, hasta: hastaTickets });
    }
    if (vista === 'resumen') establecerRangoResumenAplicado({ desde: desdeResumen, hasta: hastaResumen });
  };

  const tiposResultados = useMemo(() => [...new Set(resultados.map((resultado) => resultado.sorteo))], [resultados]);
  const resultadosFiltrados = filtroResultado === 'todos' ? resultados : resultados.filter((resultado) => resultado.sorteo === filtroResultado);
  const ticketActivo = tickets.find((ticket) => ticket.serial === ticketSeleccionado);
  const jugadasTicketOrdenadas = useMemo(
    () =>
      [...(ticketActivo?.jugadas ?? [])].sort((primera, segunda) =>
        (primera.horario_sorteo?.hora ?? '').localeCompare(segunda.horario_sorteo?.hora ?? ''),
      ),
    [ticketActivo],
  );

  return (
    <div className="fondo-consulta" role="presentation">
      <section className="ventana-consulta tarjeta" role="dialog" aria-modal="true" aria-labelledby="titulo-consulta">
        <header className="encabezado-consulta">
          <h1 id="titulo-consulta">{titulo}</h1>
          <button type="button" className="boton-cerrar" onClick={alCerrar} aria-label={t('cerrar')}>
            ×
          </button>
        </header>

        {vista === 'resultados' && (
          <div className="controles-consulta controles-resultados">
            <label className="filtro-fecha">
              {t('fecha')}
              <input
                type="date"
                value={fechaResultados}
                onChange={(evento) => establecerFechaResultados(evento.target.value)}
              />
            </label>
            <div className="filtros-sorteos" role="group" aria-label={t('filtrar_sorteos')}>
              <button
                type="button"
                className={filtroResultado === 'todos' ? 'activo' : ''}
                onClick={() => establecerFiltroResultado('todos')}
              >
                {t('todos')}
              </button>
              {tiposResultados.map((sorteo) => (
                <button
                  type="button"
                  key={sorteo}
                  className={filtroResultado === sorteo ? 'activo' : ''}
                  onClick={() => establecerFiltroResultado(sorteo)}
                >
                  {sorteo}
                </button>
              ))}
              <button type="button" className="boton-buscar" disabled={buscando} onClick={buscar}>
                {t('buscar')}
              </button>
            </div>
          </div>
        )}

        {vista === 'tickets' && (
          <div className="controles-consulta">
            <div className="filtros-rango">
              <label>
                {t('desde')}
                <input
                  type="date"
                  value={desdeTickets}
                  max={hastaTickets}
                  onChange={(evento) => establecerDesdeTickets(evento.target.value)}
                />
              </label>
              <label>
                {t('hasta')}
                <input
                  type="date"
                  value={hastaTickets}
                  min={desdeTickets}
                  onChange={(evento) => establecerHastaTickets(evento.target.value)}
                />
              </label>
              <label>
                {t('estado')}
                <select value={estado} onChange={(evento) => establecerEstado(evento.target.value)}>
                  <option value="">{t('todos')}</option>
                  <option value="ACTIVO">{t('estado_activo')}</option>
                  <option value="CANCELADO">{t('estado_cancelado')}</option>
                  <option value="PREMIADO">{t('estado_premiado')}</option>
                  <option value="PAGADO">{t('estado_pagado')}</option>
                </select>
              </label>
              <button type="button" className="boton-buscar" onClick={buscar}>
                {t('buscar')}
              </button>
            </div>
          </div>
        )}

        {vista === 'resumen' && (
          <div className="controles-consulta">
            <div className="filtros-rango">
              <label>
                {t('desde')}
                <input
                  type="date"
                  value={desdeResumen}
                  max={hastaResumen}
                  onChange={(evento) => establecerDesdeResumen(evento.target.value)}
                />
              </label>
              <label>
                {t('hasta')}
                <input
                  type="date"
                  value={hastaResumen}
                  min={desdeResumen}
                  onChange={(evento) => establecerHastaResumen(evento.target.value)}
                />
              </label>
              <button type="button" className="boton-buscar" onClick={buscar}>
                {t('buscar')}
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="estado-consulta">{t('cargando')}</p>
        ) : error ? (
          <p className="estado-consulta mensaje-error">{error}</p>
        ) : (
          <div className="contenido-consulta">
            {vista === 'resultados' &&
              (resultadosFiltrados.length ? (
                <div className="tabla-consulta tabla-resultados">
                  {resultadosFiltrados.map((resultado) => (
                    <div className="fila-consulta resultado" key={resultado.pk_resultado}>
                      <span>{resultado.hora}</span>
                      <strong>{resultado.sorteo}</strong>
                      <span>
                        {resultado.icono_animal} {resultado.codigo_animal} · {resultado.nombre_animal}
                        <small>{resultado.origen === 'AUTOMATICO' ? t('origen_automatico') : t('origen_manual')}</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="estado-consulta">{t('sin_resultados')}</p>
              ))}

            {vista === 'tickets' &&
              (tickets.length ? (
                <div className="detalle-tickets">
                  <div className="tabla-consulta lista-tickets">
                    {tickets.map((ticket) => (
                      <button
                        type="button"
                        className={`fila-consulta ticket ${ticket.serial === ticketSeleccionado ? 'seleccionado' : ''}`}
                        key={ticket.serial}
                        onClick={() => establecerTicketSeleccionado(ticket.serial)}
                      >
                        <span className="titulo-ticket">
                          <span className="linea-titulo">
                            <strong>Ticket #{ticket.numero_ticket}</strong>
                            <span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>{etiquetaEstado(ticket.estado)}</span>
                          </span>
                          <small>
                            {ticket.fecha_juego} · Serial {ticket.serial}
                          </small>
                        </span>
                        <strong>{formatearMonto(ticket.total_jugado)}</strong>
                      </button>
                    ))}
                    <div className="pie-lista">
                      <span>{t('total_mostrado', { mostrados: tickets.length, total: totalTickets })}</span>
                      {tickets.length < totalTickets && (
                        <button type="button" className="boton-secundario" onClick={() => establecerPagina((actual) => actual + 1)}>
                          {t('cargar_mas')}
                        </button>
                      )}
                    </div>
                  </div>
                  {ticketActivo ? (
                    <aside className="detalle-ticket">
                      <header>
                        <span>Ticket #{ticketActivo.numero_ticket}</span>
                        <span className={`estado-ticket ${ticketActivo.estado.toLowerCase()}`}>{etiquetaEstado(ticketActivo.estado)}</span>
                      </header>
                      <span>
                        {ticketActivo.fecha_juego} · Serial {ticketActivo.serial}
                      </span>
                      <strong>
                        {t('total')}: {formatearMonto(ticketActivo.total_jugado)}
                      </strong>
                      <span>
                        {t('estado_pagado')}: {formatearMonto(ticketActivo.monto_pagado)}
                      </span>
                      <div className="jugadas-ticket-detalle">
                        {jugadasTicketOrdenadas.map((jugada, indice) => (
                          <p key={indice}>
                            <span>
                              <b>{jugada.horario_sorteo?.hora}</b> · {jugada.horario_sorteo?.sorteo?.nombre}
                            </span>
                            <span>
                              {jugada.animal?.codigo_animal} · {jugada.animal?.nombre}
                            </span>
                            <strong>{formatearMonto(jugada.monto)}</strong>
                          </p>
                        ))}
                      </div>
                    </aside>
                  ) : (
                    <p className="estado-consulta">{t('seleccionar_ticket')}</p>
                  )}
                </div>
              ) : (
                <p className="estado-consulta">{t('sin_tickets')}</p>
              ))}

            {vista === 'resumen' && resumen && (
              <>
                <div className="metricas-resumen">
                  <div>
                    <span>{t('total_vendido')}</span>
                    <strong>
                      <NumeroAnimado valor={resumen.total_vendido} formato={formatearMonto} />
                    </strong>
                  </div>
                  <div>
                    <span>{t('total_premiado')}</span>
                    <strong>
                      <NumeroAnimado valor={resumen.total_premiado} formato={formatearMonto} />
                    </strong>
                  </div>
                  <div>
                    <span>{t('comision', { porcentaje: resumen.porcentaje_comision.toFixed(0) })}</span>
                    <strong>
                      <NumeroAnimado valor={resumen.total_comision} formato={formatearMonto} />
                    </strong>
                  </div>
                  <div>
                    <span>{t('resto')}</span>
                    <strong>
                      <NumeroAnimado valor={resumen.resto} formato={formatearMonto} />
                    </strong>
                  </div>
                </div>
                {resumen.tickets.length ? (
                  <div className="tabla-consulta">
                    {resumen.tickets.map((ticket) => (
                      <div className="fila-consulta ticket" key={ticket.serial}>
                        <span>
                          <strong>#{ticket.numero_ticket}</strong>
                          <small>
                            {ticket.fecha_juego} · {ticket.serial}
                          </small>
                        </span>
                        <span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>{etiquetaEstado(ticket.estado)}</span>
                        <strong>{formatearMonto(ticket.total_jugado)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="estado-consulta">{t('sin_datos_rango')}</p>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
