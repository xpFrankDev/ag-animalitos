import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';

type Animal = { pk_animal: number; codigo_animal: string; nombre: string; icono: string };
type Horario = { pk_horario_sorteo: number; hora: string; sorteo: string; disponible: boolean };
type Inicio = { agencia: { nombre_agencia: string; codigo_agencia: string; cupo_animal: number; jugada_minima: number; minutos_cierre: number; comision_porcentaje: number }; animales: Animal[]; horarios: Horario[]; multiplicador_premio: number };
type Jugada = { fk_animal: number; fk_horario_sorteo: number; monto: number };
type Ticket = { serial: string; numero_ticket: number; total_jugado: number };

function formatearCodigoAnimal(codigo: string) { return codigo === '0' ? codigo : codigo.padStart(2, '0'); }

export function AgenciaVentasRuta({ token, alVencerSesion }: { token: string; alVencerSesion: () => void }) {
  const { t } = useTranslation();
  const [inicio, establecerInicio] = useState<Inicio | null>(null);
  const [animalesSeleccionados, establecerAnimales] = useState<number[]>([]);
  const [horariosSeleccionados, establecerHorarios] = useState<number[]>([]);
  const [monto, establecerMonto] = useState('1');
  const [jugadas, establecerJugadas] = useState<Jugada[]>([]);
  const [mensaje, establecerMensaje] = useState('');
  const [cargando, establecerCargando] = useState(true);
  const [emitiendo, establecerEmitiendo] = useState(false);
  const [sesionVencida, establecerSesionVencida] = useState(false);
  const [ultimoTicket, establecerUltimoTicket] = useState<Ticket | null>(null);
  const [filtroSorteo, establecerFiltroSorteo] = useState('todos');
  const [horaVenezuela, establecerHoraVenezuela] = useState('');
  const referenciaMonto = useRef<HTMLInputElement>(null);

  function gestionarError(error: unknown) {
    if (error instanceof ErrorApi && error.estado === 401) { establecerSesionVencida(true); return; }
    establecerMensaje(error instanceof Error ? error.message : 'No se pudo completar la operación.');
  }

  useEffect(() => { void llamarApi<Inicio>('/agencia/inicio', {}, token).then(establecerInicio).catch(gestionarError).finally(() => establecerCargando(false)); }, [token]);
  useEffect(() => {
    if (!sesionVencida) return undefined;
    const temporizador = window.setTimeout(alVencerSesion, 2_500);
    return () => window.clearTimeout(temporizador);
  }, [sesionVencida, alVencerSesion]);
  useEffect(() => {
    const actualizarHora = () => establecerHoraVenezuela(new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }).format(new Date()));
    actualizarHora();
    const intervalo = window.setInterval(actualizarHora, 30_000);
    return () => window.clearInterval(intervalo);
  }, []);
  const animalesPorId = useMemo(() => new Map(inicio?.animales.map((animal) => [animal.pk_animal, animal]) ?? []), [inicio]);
  const animalesOrdenados = useMemo(() => [...(inicio?.animales ?? [])].sort((primero, segundo) => Number.parseInt(primero.codigo_animal, 10) - Number.parseInt(segundo.codigo_animal, 10)), [inicio]);
  const horariosPorId = useMemo(() => new Map(inicio?.horarios.map((horario) => [horario.pk_horario_sorteo, horario]) ?? []), [inicio]);
  const horariosDisponibles = useMemo(() => inicio?.horarios.filter((horario) => horario.disponible) ?? [], [inicio]);
  const tiposSorteo = useMemo(() => [...new Set(horariosDisponibles.map((horario) => horario.sorteo))], [horariosDisponibles]);
  const horariosVisibles = filtroSorteo === 'todos' ? horariosDisponibles : horariosDisponibles.filter((horario) => horario.sorteo === filtroSorteo);
  const total = jugadas.reduce((acumulado, jugada) => acumulado + jugada.monto, 0);

  const alternar = (valor: number, valores: number[], establecer: (valores: number[]) => void) => establecer(valores.includes(valor) ? valores.filter((item) => item !== valor) : [...valores, valor]);
  function alternarAnimal(pk_animal: number) {
    alternar(pk_animal, animalesSeleccionados, establecerAnimales);
    window.requestAnimationFrame(() => referenciaMonto.current?.focus());
  }
  function agregarJugada() {
    const montoNumerico = Number(monto.replace(',', '.'));
    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0 || !inicio || !animalesSeleccionados.length || !horariosSeleccionados.length) { establecerMensaje(''); return; }
    if (montoNumerico < inicio.agencia.jugada_minima) { establecerMensaje(`Monto mínimo: ${inicio.agencia.jugada_minima.toFixed(2)}`); return; }
    const nuevas = animalesSeleccionados.flatMap((fk_animal) => horariosSeleccionados.map((fk_horario_sorteo) => ({ fk_animal, fk_horario_sorteo, monto: montoNumerico })));
    const existentes = new Set(jugadas.map((jugada) => `${jugada.fk_animal}-${jugada.fk_horario_sorteo}`));
    const repetida = nuevas.some((jugada) => existentes.has(`${jugada.fk_animal}-${jugada.fk_horario_sorteo}`));
    if (repetida) { establecerMensaje('La misma combinación ya está agregada.'); return; }
    establecerJugadas([...jugadas, ...nuevas]); establecerAnimales([]); establecerHorarios([]); establecerMensaje('');
  }
  function manejarTecla(evento: KeyboardEvent<HTMLInputElement>) { if (evento.key === 'Enter') { evento.preventDefault(); agregarJugada(); } }
  async function emitir(evento: FormEvent) {
    evento.preventDefault(); if (!jugadas.length) return;
    establecerEmitiendo(true); establecerMensaje('');
    try { const ticket = await llamarApi<Ticket>('/agencia/tickets', { method: 'POST', body: JSON.stringify({ jugadas }) }, token); establecerUltimoTicket(ticket); establecerJugadas([]); establecerMensaje(t('venta_exitosa')); }
    catch (error) { gestionarError(error); } finally { establecerEmitiendo(false); }
  }

  if (cargando) return <p className="estado-pagina">Cargando Agencia…</p>;
  if (sesionVencida) return <section className="estado-sesion tarjeta" role="status"><h1>{t('sesion_vencida')}</h1><p>{t('sesion_vencida_descripcion')}</p><button type="button" className="boton-primario" onClick={alVencerSesion}>{t('salir')}</button></section>;
  if (!inicio) return <p className="estado-pagina mensaje-error">{mensaje || 'No fue posible cargar la Agencia.'}</p>;
  return <section className="ventas">
    <div className="encabezado-ventas"><p className="etiqueta nombre-agencia">{inicio.agencia.nombre_agencia} · {inicio.agencia.codigo_agencia}</p><time className="hora-venezuela">Hora Venezuela: {horaVenezuela}</time></div>
    <form className="rejilla-ventas" onSubmit={emitir}>
      <section className="tarjeta panel-animales"><div className="titulo-panel"><span>{animalesSeleccionados.length} seleccionados</span></div><div className="rejilla-animales">{animalesOrdenados.map((animal) => <button type="button" key={animal.pk_animal} aria-pressed={animalesSeleccionados.includes(animal.pk_animal)} className={`animal ${animalesSeleccionados.includes(animal.pk_animal) ? 'seleccionado' : ''}`} onClick={() => alternarAnimal(animal.pk_animal)}><b>{formatearCodigoAnimal(animal.codigo_animal)}</b><span>{animal.icono}</span><small>{animal.nombre}</small></button>)}</div></section>
      <section className="tarjeta panel-operacion"><div className="monto-agregar"><label>{t('monto')}<div className="campo-monto"><span>$</span><input ref={referenciaMonto} aria-label={t('monto')} inputMode="decimal" value={monto} onKeyDown={manejarTecla} onChange={(evento) => establecerMonto(evento.target.value)} /></div></label><button type="button" className="boton-secundario ancho-completo" onClick={agregarJugada}>{t('agregar')} ↵</button></div><div className="titulo-panel"><h2>2. {t('sorteos')}</h2><span>{horariosSeleccionados.length} seleccionados</span></div><div className="filtros-sorteos" role="group" aria-label={t('filtrar_sorteos')}><button type="button" className={filtroSorteo === 'todos' ? 'activo' : ''} aria-pressed={filtroSorteo === 'todos'} onClick={() => establecerFiltroSorteo('todos')}>{t('todos')}</button>{tiposSorteo.map((sorteo) => <button type="button" key={sorteo} className={filtroSorteo === sorteo ? 'activo' : ''} aria-pressed={filtroSorteo === sorteo} onClick={() => establecerFiltroSorteo(sorteo)}>{sorteo}</button>)}</div><div className="lista-sorteos">{horariosVisibles.map((horario) => <label className={`opcion-sorteo ${horariosSeleccionados.includes(horario.pk_horario_sorteo) ? 'seleccionado' : ''}`} key={horario.pk_horario_sorteo}><input type="checkbox" checked={horariosSeleccionados.includes(horario.pk_horario_sorteo)} onChange={() => alternar(horario.pk_horario_sorteo, horariosSeleccionados, establecerHorarios)} /><span><b>{horario.sorteo}</b><small>{horario.hora}</small></span></label>)}</div></section>
      <aside className="tarjeta panel-ticket"><div className="lista-jugadas">{jugadas.length === 0 ? <p className="vacio">{t('no_hay_jugadas')}</p> : jugadas.map((jugada, indice) => { const animal = animalesPorId.get(jugada.fk_animal); const horario = horariosPorId.get(jugada.fk_horario_sorteo); return <div className="fila-jugada" key={`${jugada.fk_animal}-${jugada.fk_horario_sorteo}`}><span>{animal?.icono} <b>{animal ? formatearCodigoAnimal(animal.codigo_animal) : ''}</b> · {animal?.nombre}<small>{horario?.sorteo} {horario?.hora}</small></span><strong>${jugada.monto.toFixed(2)}</strong><button type="button" aria-label="Eliminar jugada" onClick={() => establecerJugadas(jugadas.filter((_, posicion) => posicion !== indice))}>×</button></div>; })}</div><div className="total total-superior"><span>Total ticket</span><strong>${total.toFixed(2)}</strong></div><button className="boton-primario ancho-completo" disabled={!jugadas.length || emitiendo}>{emitiendo ? '…' : t('emitir')}</button></aside>
    </form>
    <section className="acciones-ticket tarjeta" aria-label="Acciones de ticket">
      <button type="button">Repetir ticket</button>
      <button type="button">Anular ticket</button>
      <button type="button">Pagar ticket</button>
    </section>
    {mensaje && <div className="notificacion" role="status">{mensaje}</div>}
    {ultimoTicket && <section className="recibo"><span>✓</span><div><strong>{t('ticket')} #{ultimoTicket.numero_ticket}</strong><p>Serial: {ultimoTicket.serial} · ${Number(ultimoTicket.total_jugado).toFixed(2)}</p></div></section>}
  </section>;
}
