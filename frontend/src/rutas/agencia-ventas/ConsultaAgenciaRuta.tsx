import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { llamarApi } from '../../compartido/api/cliente';

type VistaConsulta = 'resultados' | 'tickets' | 'resumen';
type Resultado = { pk_resultado: string; hora: string; sorteo: string; codigo_animal: string; nombre_animal: string; icono_animal: string; es_demostracion?: boolean };
type JugadaTicket = { monto: string; animal?: { codigo_animal: string; nombre: string }; horario_sorteo?: { hora: string; sorteo?: { nombre: string } } };
type Ticket = { serial: string; numero_ticket: number; fecha_juego: string; estado: 'ACTIVO' | 'CANCELADO' | 'PREMIADO' | 'PAGADO'; total_jugado: string; total_premio: string; monto_pagado: string; jugadas?: JugadaTicket[]; es_demostracion?: boolean };
type Resumen = { desde: string; hasta: string; total_vendido: number; total_premiado: number; porcentaje_premiado: number; resto: number; tickets: Ticket[] };

function fechaCaracas() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date()); }
function inicioSemana(fecha: string) { const valor = new Date(`${fecha}T12:00:00`); valor.setDate(valor.getDate() - ((valor.getDay() + 6) % 7)); return valor.toISOString().slice(0, 10); }
function formatearMonto(valor: number | string) { return `$${Number(valor).toFixed(2)}`; }
const ticketsDemostracion: Ticket[] = [{ serial: 'AG-DEMO-240914', numero_ticket: 1204, fecha_juego: fechaCaracas(), estado: 'ACTIVO', total_jugado: '8.00', total_premio: '0.00', monto_pagado: '0.00', es_demostracion: true, jugadas: [{ monto: '4.00', animal: { codigo_animal: '05', nombre: 'León' }, horario_sorteo: { hora: '14:00', sorteo: { nombre: 'Lotto Activo' } } }, { monto: '4.00', animal: { codigo_animal: '18', nombre: 'Burro' }, horario_sorteo: { hora: '16:00', sorteo: { nombre: 'La Granjita' } } }] }];

function NumeroAnimado({ valor, formato = (numero: number) => numero.toFixed(2) }: { valor: number; formato?: (numero: number) => string }) {
  const [visible, establecerVisible] = useState(0);
  useEffect(() => { const inicio = performance.now(); let marco = 0; const animar = (ahora: number) => { const avance = Math.min(1, (ahora - inicio) / 3_000); establecerVisible(valor * (1 - ((1 - avance) ** 3))); if (avance < 1) marco = requestAnimationFrame(animar); }; marco = requestAnimationFrame(animar); return () => cancelAnimationFrame(marco); }, [valor]);
  return <>{formato(visible)}</>;
}

export function ConsultaAgenciaRuta({ token, vista, alCerrar }: { token: string; vista: VistaConsulta; alCerrar: () => void }) {
  const { t } = useTranslation();
  const fechaHoy = useMemo(fechaCaracas, []);
  const [fechaResultados, establecerFechaResultados] = useState(fechaHoy);
  const [fechaResultadosAplicada, establecerFechaResultadosAplicada] = useState(fechaHoy);
  const [estado, establecerEstado] = useState('');
  const [desdeTickets, establecerDesdeTickets] = useState(() => inicioSemana(fechaHoy));
  const [hastaTickets, establecerHastaTickets] = useState(fechaHoy);
  const [filtroTicketsAplicado, establecerFiltroTicketsAplicado] = useState(() => ({ estado: '', desde: inicioSemana(fechaHoy), hasta: fechaHoy }));
  const [desdeResumen, establecerDesdeResumen] = useState(() => inicioSemana(fechaHoy));
  const [hastaResumen, establecerHastaResumen] = useState(fechaHoy);
  const [rangoResumenAplicado, establecerRangoResumenAplicado] = useState(() => ({ desde: inicioSemana(fechaHoy), hasta: fechaHoy }));
  const [resultados, establecerResultados] = useState<Resultado[]>([]);
  const [tickets, establecerTickets] = useState<Ticket[]>([]);
  const [resumen, establecerResumen] = useState<Resumen | null>(null);
  const [cargando, establecerCargando] = useState(true);
  const [buscando, establecerBuscando] = useState(false);
  const [error, establecerError] = useState('');
  const [aviso, establecerAviso] = useState('');
  const [versionResultados, establecerVersionResultados] = useState(0);
  const [filtroResultado, establecerFiltroResultado] = useState('todos');
  const [ticketSeleccionado, establecerTicketSeleccionado] = useState('');

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = window.setTimeout(() => establecerAviso(''), 3_000);
    return () => window.clearTimeout(temporizador);
  }, [aviso]);

  useEffect(() => {
    let activo = true;
    establecerError('');
    const cargar = async () => {
      try {
        if (vista === 'resultados') establecerResultados(await llamarApi<Resultado[]>(`/agencia/resultados?fecha=${fechaResultadosAplicada}`, {}, token));
        if (vista === 'tickets') { const parametros = new URLSearchParams({ desde: filtroTicketsAplicado.desde, hasta: filtroTicketsAplicado.hasta }); if (filtroTicketsAplicado.estado) parametros.set('estado', filtroTicketsAplicado.estado); const respuesta = await llamarApi<Ticket[]>(`/agencia/tickets?${parametros.toString()}`, {}, token); const lista = respuesta.length ? respuesta : ticketsDemostracion; establecerTickets(lista); establecerTicketSeleccionado(lista[0]?.serial ?? ''); if (!respuesta.length) establecerAviso(t('ejemplo_temporal')); }
        if (vista === 'resumen') establecerResumen(await llamarApi<Resumen>(`/agencia/resumen-ventas?desde=${rangoResumenAplicado.desde}&hasta=${rangoResumenAplicado.hasta}`, {}, token));
      } catch (causa) { if (activo) establecerError(causa instanceof Error ? causa.message : t('consulta_error')); }
      finally { if (activo) { establecerCargando(false); establecerBuscando(false); } }
    };
    void cargar();
    return () => { activo = false; };
  }, [vista, token, fechaResultadosAplicada, filtroTicketsAplicado, rangoResumenAplicado, versionResultados, t]);

  const etiquetaEstado = (valor: Ticket['estado']) => t(`estado_${valor.toLowerCase()}`);
  const titulo = vista === 'resultados' ? t('ver_resultados') : vista === 'tickets' ? t('listado_tickets') : t('resumen_ventas');
  const buscar = () => {
    establecerBuscando(true);
    if (vista === 'resultados') { establecerFechaResultadosAplicada(fechaResultados); establecerVersionResultados((actual) => actual + 1); }
    if (vista === 'tickets') establecerFiltroTicketsAplicado({ estado, desde: desdeTickets, hasta: hastaTickets });
    if (vista === 'resumen') establecerRangoResumenAplicado({ desde: desdeResumen, hasta: hastaResumen });
  };
  const tiposResultados = useMemo(() => [...new Set(resultados.map((resultado) => resultado.sorteo))], [resultados]);
  const resultadosFiltrados = filtroResultado === 'todos' ? resultados : resultados.filter((resultado) => resultado.sorteo === filtroResultado);
  const ticketActivo = tickets.find((ticket) => ticket.serial === ticketSeleccionado);

  return <div className="fondo-consulta" role="presentation"><section className="ventana-consulta tarjeta" role="dialog" aria-modal="true" aria-labelledby="titulo-consulta">
    <header className="encabezado-consulta"><h1 id="titulo-consulta">{titulo}</h1><button type="button" className="boton-cerrar" onClick={alCerrar} aria-label={t('cerrar')}>×</button></header>
    {vista === 'resultados' && <div className="controles-consulta controles-resultados"><label className="filtro-fecha">{t('fecha')}<input type="date" value={fechaResultados} onChange={(evento) => establecerFechaResultados(evento.target.value)} /></label><div className="filtros-sorteos" role="group" aria-label={t('filtrar_sorteos')}><button type="button" className={filtroResultado === 'todos' ? 'activo' : ''} onClick={() => establecerFiltroResultado('todos')}>{t('todos')}</button>{tiposResultados.map((sorteo) => <button type="button" key={sorteo} className={filtroResultado === sorteo ? 'activo' : ''} onClick={() => establecerFiltroResultado(sorteo)}>{sorteo}</button>)}</div><button type="button" className="boton-secundario" disabled={buscando} onClick={buscar}>{t('buscar')}</button></div>}
    {vista === 'tickets' && <div className="controles-consulta"><div className="filtros-rango"><label>{t('desde')}<input type="date" value={desdeTickets} max={hastaTickets} onChange={(evento) => establecerDesdeTickets(evento.target.value)} /></label><label>{t('hasta')}<input type="date" value={hastaTickets} min={desdeTickets} onChange={(evento) => establecerHastaTickets(evento.target.value)} /></label><label>{t('estado')}<select value={estado} onChange={(evento) => establecerEstado(evento.target.value)}><option value="">{t('todos')}</option><option value="ACTIVO">{t('estado_activo')}</option><option value="CANCELADO">{t('estado_cancelado')}</option><option value="PREMIADO">{t('estado_premiado')}</option><option value="PAGADO">{t('estado_pagado')}</option></select></label></div><button type="button" className="boton-secundario" onClick={buscar}>{t('buscar')}</button></div>}
    {vista === 'resumen' && <div className="controles-consulta"><div className="filtros-rango"><label>{t('desde')}<input type="date" value={desdeResumen} max={hastaResumen} onChange={(evento) => establecerDesdeResumen(evento.target.value)} /></label><label>{t('hasta')}<input type="date" value={hastaResumen} min={desdeResumen} onChange={(evento) => establecerHastaResumen(evento.target.value)} /></label></div><button type="button" className="boton-secundario" onClick={buscar}>{t('buscar')}</button></div>}
    {cargando ? <p className="estado-consulta">{t('cargando')}</p> : error ? <p className="estado-consulta mensaje-error">{error}</p> : <div className="contenido-consulta">
      {vista === 'resultados' && (resultadosFiltrados.length ? <div className="tabla-consulta tabla-resultados">{resultadosFiltrados.map((resultado) => <div className="fila-consulta resultado" key={resultado.pk_resultado}><span>{resultado.hora}</span><strong>{resultado.sorteo}</strong><span>{resultado.icono_animal} {resultado.codigo_animal} · {resultado.nombre_animal}{resultado.es_demostracion && <small>{t('ejemplo_temporal')}</small>}</span></div>)}</div> : <p className="estado-consulta">{t('sin_resultados')}</p>)}
      {vista === 'tickets' && (tickets.length ? <div className="detalle-tickets"><div className="tabla-consulta">{tickets.map((ticket) => <button type="button" className={`fila-consulta ticket ${ticket.serial === ticketSeleccionado ? 'seleccionado' : ''}`} key={ticket.serial} onClick={() => establecerTicketSeleccionado(ticket.serial)}><span><strong>#{ticket.numero_ticket}</strong><small>{ticket.fecha_juego} · {ticket.serial}</small></span><span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>{etiquetaEstado(ticket.estado)}</span><strong>{formatearMonto(ticket.total_jugado)}</strong></button>)}</div>{ticketActivo && <aside className="detalle-ticket"><span>{ticketActivo.fecha_juego} · {etiquetaEstado(ticketActivo.estado)}</span><strong>{t('total')}: {formatearMonto(ticketActivo.total_jugado)}</strong><span>{t('estado_pagado')}: {formatearMonto(ticketActivo.monto_pagado)}</span><hr/>{ticketActivo.jugadas?.map((jugada, indice) => <p key={indice}>{jugada.animal?.codigo_animal} · {jugada.animal?.nombre}<small>{jugada.horario_sorteo?.sorteo?.nombre} {jugada.horario_sorteo?.hora} · {formatearMonto(jugada.monto)}</small></p>)}</aside>}</div> : <p className="estado-consulta">{t('sin_tickets')}</p>)}
      {vista === 'resumen' && resumen && <><div className="metricas-resumen"><div><span>{t('total_vendido')}</span><strong><NumeroAnimado valor={resumen.total_vendido} formato={formatearMonto} /></strong></div><div><span>{t('total_premiado')}</span><strong><NumeroAnimado valor={resumen.total_premiado} formato={formatearMonto} /></strong></div><div><span>{t('porcentaje')}</span><strong><NumeroAnimado valor={resumen.porcentaje_premiado} formato={(numero) => `${numero.toFixed(2)}%`} /></strong></div><div><span>{t('resto')}</span><strong><NumeroAnimado valor={resumen.resto} formato={formatearMonto} /></strong></div></div>{resumen.tickets.length ? <div className="tabla-consulta">{resumen.tickets.map((ticket) => <div className="fila-consulta ticket" key={ticket.serial}><span><strong>#{ticket.numero_ticket}</strong><small>{ticket.fecha_juego} · {ticket.serial}</small></span><span className={`estado-ticket ${ticket.estado.toLowerCase()}`}>{etiquetaEstado(ticket.estado)}</span><strong>{formatearMonto(ticket.total_jugado)}</strong></div>)}</div> : <p className="estado-consulta">{t('sin_datos_rango')}</p>}</>}
    </div>}
    {aviso && <p className="notificacion emergente" role="status">{aviso}</p>}
  </section></div>;
}
