import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../../compartido/api/cliente';
import { fechaCaracas, formatearMonto as monto } from '../../../compartido/utilidades/formato';
import type { Avisar, Agencia, PaginaTickets, TicketOperacion } from '../tipos';

type Propiedades = {
  token: string;
  agencias: Agencia[];
  alVencerSesion: () => void;
  avisar: Avisar;
};

type Filtros = { desde: string; hasta: string; agencia: string; estado: string };

const TAMANO_PAGINA = 25;

/** Sub módulo de tickets: consulta independiente por rango, agencia y estado. */
export function SeccionTickets({ token, agencias, alVencerSesion, avisar }: Propiedades) {
  const { t } = useTranslation();
  const hoy = fechaCaracas();
  const [desde, establecerDesde] = useState(hoy);
  const [hasta, establecerHasta] = useState(hoy);
  const [agencia, establecerAgencia] = useState('');
  const [estado, establecerEstado] = useState('');
  const [filtros, establecerFiltros] = useState<Filtros>({ desde: hoy, hasta: hoy, agencia: '', estado: '' });
  const [pagina, establecerPagina] = useState(1);
  const [tickets, establecerTickets] = useState<TicketOperacion[]>([]);
  const [total, establecerTotal] = useState(0);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState('');

  const cargar = useCallback(
    async (paginaSolicitada: number, aplicados: Filtros) => {
      establecerCargando(true);
      establecerError('');
      try {
        const parametros = new URLSearchParams({
          desde: aplicados.desde,
          hasta: aplicados.hasta,
          pagina: String(paginaSolicitada),
          tamano: String(TAMANO_PAGINA),
        });
        if (aplicados.agencia) parametros.set('agencia', aplicados.agencia);
        if (aplicados.estado) parametros.set('estado', aplicados.estado);
        const respuesta = await llamarApi<PaginaTickets>(`/operacion/tickets?${parametros.toString()}`, {}, token);
        establecerTickets((actuales) => (paginaSolicitada === 1 ? respuesta.tickets : [...actuales, ...respuesta.tickets]));
        establecerTotal(respuesta.total);
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
    void cargar(pagina, filtros);
  }, [cargar, pagina, filtros]);

  function buscar() {
    if (desde > hasta) {
      avisar(t('error_consulta'));
      return;
    }
    establecerPagina(1);
    establecerFiltros({ desde, hasta, agencia, estado });
  }

  return (
    <section className="tarjeta bloque-operacion">
      <header className="cabecera-bloque">
        <div>
          <h2>{t('listado_tickets')}</h2>
          <small className="rango-aplicado">
            {t('rango_aplicado', { desde: filtros.desde, hasta: filtros.hasta })}
          </small>
        </div>
        <span className="contador-operacion">{t('total_mostrado', { mostrados: tickets.length, total })}</span>
      </header>

      <div className="filtros-operacion filtros-tickets">
        <div className="filtros-rango">
          <label>
            {t('desde')}
            <input type="date" value={desde} max={hasta} onChange={(evento) => establecerDesde(evento.target.value)} />
          </label>
          <label>
            {t('hasta')}
            <input type="date" value={hasta} min={desde} onChange={(evento) => establecerHasta(evento.target.value)} />
          </label>
          <label>
            {t('agencia')}
            <select value={agencia} onChange={(evento) => establecerAgencia(evento.target.value)}>
              <option value="">{t('todas_las_agencias')}</option>
              {agencias.map((item) => (
                <option key={item.pk_agencia} value={item.pk_agencia}>
                  {item.nombre_agencia}
                </option>
              ))}
            </select>
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
          <button type="button" className="boton-buscar" disabled={cargando} onClick={buscar}>
            {cargando ? t('actualizando') : t('buscar')}
          </button>
        </div>
      </div>

      {error ? (
        <p className="vacio-operacion mensaje-error">{error}</p>
      ) : tickets.length ? (
        <>
          <div className="tabla-operacion">
            {tickets.map((ticket) => (
              <div key={ticket.serial}>
                <span className="titulo-ticket">
                  <span className="linea-titulo">
                    <strong>
                      #{ticket.numero_ticket} · {ticket.agencia}
                    </strong>
                    <span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>{t(`estado_${ticket.estado.toLowerCase()}`)}</span>
                  </span>
                  <small>
                    {ticket.fecha_juego} · {ticket.serial}
                  </small>
                </span>
                <strong>{monto(ticket.total_jugado)}</strong>
              </div>
            ))}
          </div>
          <div className="pie-lista">
            <span>{t('total_mostrado', { mostrados: tickets.length, total })}</span>
            {tickets.length < total && (
              <button
                type="button"
                className="boton-secundario"
                disabled={cargando}
                onClick={() => establecerPagina((actual) => actual + 1)}
              >
                {t('cargar_mas')}
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="vacio-operacion">{cargando ? t('cargando') : t('sin_tickets')}</p>
      )}
    </section>
  );
}
