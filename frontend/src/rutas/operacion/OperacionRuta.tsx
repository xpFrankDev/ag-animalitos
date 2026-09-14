import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';

type Vista = 'agencias' | 'tickets' | 'resultados';
type Inicio = {
  perfil: { nombre_completo: string; tipo_usuario: 'GRUPERO' | 'BANQUERO' };
  permisos: { puede_registrar_resultados: boolean };
  resumen: { total_vendido: number; total_premiado: number; tickets: number; agencias: number };
  agencias: { pk_agencia: string; codigo_agencia: string; nombre_agencia: string; activa: boolean; operador: string }[];
  gruperos: { pk_grupero: string; nombre_completo: string; activo: boolean }[];
  tickets: { serial: string; numero_ticket: number; fecha_juego: string; estado: string; total_jugado: string; agencia: string }[];
  resultados: { pk_resultado: string; fecha_juego: string; hora: string; sorteo: string; codigo_animal: string; nombre_animal: string; icono_animal: string }[];
};
type Catalogo = { animales: { pk_animal: number; codigo_animal: string; nombre: string; icono: string }[]; horarios: { pk_horario_sorteo: number; hora: string; sorteo: string }[] };

function monto(valor: number | string) { return `$${Number(valor).toFixed(2)}`; }
function fechaCaracas() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date()); }

export function OperacionRuta({ token, alVencerSesion }: { token: string; alVencerSesion: () => void }) {
  const { t } = useTranslation();
  const [inicio, establecerInicio] = useState<Inicio | null>(null);
  const [vista, establecerVista] = useState<Vista>('agencias');
  const [cargando, establecerCargando] = useState(true);
  const [mensaje, establecerMensaje] = useState('');
  const [modalResultado, establecerModalResultado] = useState(false);
  const [catalogo, establecerCatalogo] = useState<Catalogo | null>(null);
  const [fecha, establecerFecha] = useState(fechaCaracas);
  const [horario, establecerHorario] = useState('');
  const [animal, establecerAnimal] = useState('');
  const [guardando, establecerGuardando] = useState(false);

  const cargar = useCallback(async () => {
    establecerCargando(true);
    try { establecerInicio(await llamarApi<Inicio>('/operacion/inicio', {}, token)); }
    catch (error) { if (error instanceof ErrorApi && error.estado === 401) alVencerSesion(); else establecerMensaje(error instanceof Error ? error.message : t('consulta_error')); }
    finally { establecerCargando(false); }
  }, [alVencerSesion, t, token]);
  useEffect(() => { void cargar(); }, [cargar]);
  const titulo = inicio?.perfil.tipo_usuario === 'BANQUERO' ? t('panel_banquero') : t('panel_grupero');
  const resultadosVisibles = useMemo(() => inicio?.resultados ?? [], [inicio]);

  async function abrirResultado() {
    try { const datos = await llamarApi<Catalogo>('/operacion/catalogo-resultados', {}, token); establecerCatalogo(datos); establecerHorario(datos.horarios[0] ? String(datos.horarios[0].pk_horario_sorteo) : ''); establecerAnimal(datos.animales[0] ? String(datos.animales[0].pk_animal) : ''); establecerModalResultado(true); }
    catch (error) { establecerMensaje(error instanceof Error ? error.message : t('consulta_error')); }
  }
  async function guardarResultado(evento: FormEvent) {
    evento.preventDefault();
    if (!fecha || !horario || !animal) { establecerMensaje(t('resultado_incompleto')); return; }
    establecerGuardando(true);
    try { const respuesta = await llamarApi<{ mensaje: string }>('/operacion/resultados', { method: 'POST', body: JSON.stringify({ fecha_juego: fecha, fk_horario_sorteo: Number(horario), fk_animal: Number(animal) }) }, token); establecerMensaje(respuesta.mensaje); establecerModalResultado(false); await cargar(); }
    catch (error) { establecerMensaje(error instanceof Error ? error.message : t('consulta_error')); }
    finally { establecerGuardando(false); }
  }

  if (cargando) return <p className="estado-pagina">{t('cargando')}</p>;
  if (!inicio) return <p className="estado-pagina mensaje-error">{mensaje || t('consulta_error')}</p>;
  return <section className="operacion">
    <header className="encabezado-operacion"><div><h1>{titulo}</h1><p>{inicio.perfil.nombre_completo}</p></div><span>{inicio.resumen.agencias} {t('agencias')}</span></header>
    <section className="metricas-operacion" aria-label={t('resumen_ventas')}><div><span>{t('total_vendido')}</span><strong>{monto(inicio.resumen.total_vendido)}</strong></div><div><span>{t('total_premiado')}</span><strong>{monto(inicio.resumen.total_premiado)}</strong></div><div><span>{t('tickets')}</span><strong>{inicio.resumen.tickets}</strong></div><div><span>{t('agencias')}</span><strong>{inicio.resumen.agencias}</strong></div></section>
    <nav className="pestanas-operacion" aria-label={t('navegacion_principal')}><button type="button" className={vista === 'agencias' ? 'activo' : ''} onClick={() => establecerVista('agencias')}>{t('agencias')}</button><button type="button" className={vista === 'tickets' ? 'activo' : ''} onClick={() => establecerVista('tickets')}>{t('listado_tickets')}</button><button type="button" className={vista === 'resultados' ? 'activo' : ''} onClick={() => establecerVista('resultados')}>{t('ver_resultados')}</button></nav>
    {vista === 'agencias' && <div className="tablero-operacion">{inicio.perfil.tipo_usuario === 'BANQUERO' && <section className="tarjeta bloque-operacion"><h2>{t('gruperos')}</h2>{inicio.gruperos.length ? <div className="lista-operacion">{inicio.gruperos.map((grupero) => <div key={grupero.pk_grupero}><strong>{grupero.nombre_completo}</strong><span className={grupero.activo ? 'estado-activo' : 'estado-inactivo'}>{grupero.activo ? t('activo') : t('inactivo')}</span></div>)}</div> : <p className="vacio-operacion">{t('sin_gruperos')}</p>}</section>}<section className="tarjeta bloque-operacion"><h2>{t('agencias')}</h2>{inicio.agencias.length ? <div className="tabla-operacion">{inicio.agencias.map((agencia) => <div key={agencia.pk_agencia}><span><strong>{agencia.nombre_agencia}</strong><small>{agencia.codigo_agencia} · {agencia.operador}</small></span><span className={agencia.activa ? 'estado-activo' : 'estado-inactivo'}>{agencia.activa ? t('activo') : t('inactivo')}</span></div>)}</div> : <p className="vacio-operacion">{t('sin_agencias')}</p>}</section></div>}
    {vista === 'tickets' && <section className="tarjeta bloque-operacion"><h2>{t('listado_tickets')}</h2>{inicio.tickets.length ? <div className="tabla-operacion">{inicio.tickets.map((ticket) => <div key={ticket.serial}><span><strong>#{ticket.numero_ticket} · {ticket.agencia}</strong><small>{ticket.fecha_juego} · {ticket.serial}</small></span><span>{ticket.estado}</span><strong>{monto(ticket.total_jugado)}</strong></div>)}</div> : <p className="vacio-operacion">{t('sin_tickets')}</p>}</section>}
    {vista === 'resultados' && <section className="tarjeta bloque-operacion"><header className="cabecera-bloque"><h2>{t('ver_resultados')}</h2>{inicio.permisos.puede_registrar_resultados && <button type="button" className="boton-primario" onClick={() => void abrirResultado()}>{t('registrar_resultado')}</button>}</header>{resultadosVisibles.length ? <div className="tabla-operacion">{resultadosVisibles.map((resultado) => <div key={resultado.pk_resultado}><span><strong>{resultado.sorteo} · {resultado.hora}</strong><small>{resultado.fecha_juego}</small></span><strong>{resultado.icono_animal} {resultado.codigo_animal} · {resultado.nombre_animal}</strong></div>)}</div> : <p className="vacio-operacion">{t('sin_resultados')}</p>}</section>}
    {mensaje && <p className="notificacion" role="status">{mensaje}</p>}
    {modalResultado && <div className="fondo-consulta"><form className="ventana-consulta tarjeta formulario-resultado" onSubmit={guardarResultado}><header className="encabezado-consulta"><h2>{t('registrar_resultado')}</h2><button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerModalResultado(false)}>×</button></header><label>{t('fecha')}<input type="date" value={fecha} onChange={(evento) => establecerFecha(evento.target.value)} required /></label><label>{t('sorteos')}<select value={horario} onChange={(evento) => establecerHorario(evento.target.value)} required>{catalogo?.horarios.map((item) => <option key={item.pk_horario_sorteo} value={item.pk_horario_sorteo}>{item.sorteo} · {item.hora}</option>)}</select></label><label>{t('animal_manual')}<select value={animal} onChange={(evento) => establecerAnimal(evento.target.value)} required>{catalogo?.animales.map((item) => <option key={item.pk_animal} value={item.pk_animal}>{item.icono} {item.codigo_animal} · {item.nombre}</option>)}</select></label><button className="boton-primario" disabled={guardando}>{guardando ? '…' : t('guardar_resultado')}</button></form></div>}
  </section>;
}
