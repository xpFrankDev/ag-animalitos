import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { llamarApi } from '../../compartido/api/cliente';

type VistaConsulta = 'resultados' | 'tickets' | 'resumen';
type Resultado = { pk_resultado: string; hora: string; sorteo: string; codigo_animal: string; nombre_animal: string; icono_animal: string };
type Ticket = { serial: string; numero_ticket: number; fecha_juego: string; estado: 'ACTIVO' | 'CANCELADO' | 'PREMIADO' | 'PAGADO'; total_jugado: string; total_premio: string; monto_pagado: string };
type Resumen = { desde: string; hasta: string; total_vendido: number; total_premiado: number; porcentaje_premiado: number; resto: number; tickets: Ticket[] };

function fechaCaracas() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date()); }
function inicioSemana(fecha: string) { const valor = new Date(`${fecha}T12:00:00`); valor.setDate(valor.getDate() - ((valor.getDay() + 6) % 7)); return valor.toISOString().slice(0, 10); }
function formatearMonto(valor: number | string) { return `$${Number(valor).toFixed(2)}`; }

export function ConsultaAgenciaRuta({ token, vista, alCerrar }: { token: string; vista: VistaConsulta; alCerrar: () => void }) {
  const { t } = useTranslation();
  const fechaHoy = useMemo(fechaCaracas, []);
  const [fechaResultados, establecerFechaResultados] = useState(fechaHoy);
  const [estado, establecerEstado] = useState('');
  const [desde, establecerDesde] = useState(() => inicioSemana(fechaHoy));
  const [hasta, establecerHasta] = useState(fechaHoy);
  const [resultados, establecerResultados] = useState<Resultado[]>([]);
  const [tickets, establecerTickets] = useState<Ticket[]>([]);
  const [resumen, establecerResumen] = useState<Resumen | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [error, establecerError] = useState('');

  useEffect(() => {
    let activo = true;
    establecerCargando(true); establecerError('');
    const cargar = async () => {
      try {
        if (vista === 'resultados') establecerResultados(await llamarApi<Resultado[]>(`/agencia/resultados?fecha=${fechaResultados}`, {}, token));
        if (vista === 'tickets') establecerTickets(await llamarApi<Ticket[]>(`/agencia/tickets${estado ? `?estado=${estado}` : ''}`, {}, token));
        if (vista === 'resumen') establecerResumen(await llamarApi<Resumen>(`/agencia/resumen-ventas?desde=${desde}&hasta=${hasta}`, {}, token));
      } catch (causa) { if (activo) establecerError(causa instanceof Error ? causa.message : t('consulta_error')); }
      finally { if (activo) establecerCargando(false); }
    };
    void cargar();
    return () => { activo = false; };
  }, [vista, token, fechaResultados, estado, desde, hasta, t]);

  const etiquetaEstado = (valor: Ticket['estado']) => t(`estado_${valor.toLowerCase()}`);
  const titulo = vista === 'resultados' ? t('ver_resultados') : vista === 'tickets' ? t('listado_tickets') : t('resumen_ventas');

  return <div className="fondo-consulta" role="presentation"><section className="ventana-consulta tarjeta" role="dialog" aria-modal="true" aria-labelledby="titulo-consulta">
    <header className="encabezado-consulta"><h1 id="titulo-consulta">{titulo}</h1><button type="button" className="boton-cerrar" onClick={alCerrar} aria-label={t('cerrar')}>×</button></header>
    {vista === 'resultados' && <label className="filtro-fecha">{t('fecha')}<input type="date" value={fechaResultados} onChange={(evento) => establecerFechaResultados(evento.target.value)} /></label>}
    {vista === 'tickets' && <label className="filtro-fecha">{t('estado')}<select value={estado} onChange={(evento) => establecerEstado(evento.target.value)}><option value="">{t('todos')}</option><option value="ACTIVO">{t('estado_activo')}</option><option value="CANCELADO">{t('estado_cancelado')}</option><option value="PREMIADO">{t('estado_premiado')}</option><option value="PAGADO">{t('estado_pagado')}</option></select></label>}
    {vista === 'resumen' && <div className="filtros-rango"><label>{t('desde')}<input type="date" value={desde} max={hasta} onChange={(evento) => establecerDesde(evento.target.value)} /></label><label>{t('hasta')}<input type="date" value={hasta} min={desde} onChange={(evento) => establecerHasta(evento.target.value)} /></label></div>}
    {cargando ? <p className="estado-consulta">{t('cargando')}</p> : error ? <p className="estado-consulta mensaje-error">{error}</p> : <div className="contenido-consulta">
      {vista === 'resultados' && (resultados.length ? <div className="tabla-consulta">{resultados.map((resultado) => <div className="fila-consulta resultado" key={resultado.pk_resultado}><span>{resultado.hora}</span><strong>{resultado.sorteo}</strong><span>{resultado.icono_animal} {resultado.codigo_animal} · {resultado.nombre_animal}</span></div>)}</div> : <p className="estado-consulta">{t('sin_resultados')}</p>)}
      {vista === 'tickets' && (tickets.length ? <div className="tabla-consulta">{tickets.map((ticket) => <div className="fila-consulta ticket" key={ticket.serial}><span><strong>#{ticket.numero_ticket}</strong><small>{ticket.fecha_juego} · {ticket.serial}</small></span><span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>{etiquetaEstado(ticket.estado)}</span><strong>{formatearMonto(ticket.total_jugado)}</strong></div>)}</div> : <p className="estado-consulta">{t('sin_tickets')}</p>)}
      {vista === 'resumen' && resumen && <><div className="metricas-resumen"><div><span>{t('total_vendido')}</span><strong>{formatearMonto(resumen.total_vendido)}</strong></div><div><span>{t('total_premiado')}</span><strong>{formatearMonto(resumen.total_premiado)}</strong></div><div><span>{t('porcentaje')}</span><strong>{resumen.porcentaje_premiado.toFixed(2)}%</strong></div><div><span>{t('resto')}</span><strong>{formatearMonto(resumen.resto)}</strong></div></div>{resumen.tickets.length ? <div className="tabla-consulta">{resumen.tickets.map((ticket) => <div className="fila-consulta ticket" key={ticket.serial}><span><strong>#{ticket.numero_ticket}</strong><small>{ticket.fecha_juego} · {ticket.serial}</small></span><span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>{etiquetaEstado(ticket.estado)}</span><strong>{formatearMonto(ticket.total_jugado)}</strong></div>)}</div> : <p className="estado-consulta">{t('sin_tickets')}</p>}</>}
    </div>}
  </section></div>;
}
