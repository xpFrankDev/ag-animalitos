import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';

type Animal = { pk_animal: number; codigo_animal: string; nombre: string; icono: string };
type Horario = { pk_horario_sorteo: number; hora: string; sorteo: string; disponible: boolean };
type Inicio = { agencia: { nombre_agencia: string; codigo_agencia: string; cupo_animal: number; jugada_minima: number; minutos_cierre: number; comision_porcentaje: number }; animales: Animal[]; horarios: Horario[]; multiplicador_premio: number };
type Jugada = { fk_animal: number; fk_horario_sorteo: number; monto: number };
type Ticket = { serial: string; numero_ticket: number; total_jugado: number };

function formatearCodigoAnimal(codigo: string) { return codigo === '0' ? codigo : codigo.padStart(2, '0'); }

function minutosEnVenezuela(fecha: Date) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(fecha);
  const hora = Number(partes.find((parte) => parte.type === 'hour')?.value ?? 0);
  const minuto = Number(partes.find((parte) => parte.type === 'minute')?.value ?? 0);
  return hora * 60 + minuto;
}

function sigueDisponible(horario: Horario, minutosCierre: number, minutosActuales: number) {
  const [hora, minuto] = horario.hora.split(':').map(Number);
  return horario.disponible && minutosActuales < (hora * 60) + minuto - minutosCierre;
}

function codigoAnimalComparable(codigo: string) {
  const valor = codigo.trim();
  if (valor === '0' || valor === '00') return valor;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= 36 ? formatearCodigoAnimal(String(numero)) : '';
}

export function AgenciaVentasRuta({ token, alVencerSesion }: { token: string; alVencerSesion: () => void }) {
  const { t } = useTranslation();
  const [inicio, establecerInicio] = useState<Inicio | null>(null);
  const [animalesSeleccionados, establecerAnimales] = useState<number[]>([]);
  const [horariosSeleccionados, establecerHorarios] = useState<number[]>([]);
  const [monto, establecerMonto] = useState('1');
  const [codigoAnimalManual, establecerCodigoAnimalManual] = useState('');
  const [jugadas, establecerJugadas] = useState<Jugada[]>([]);
  const [mensaje, establecerMensaje] = useState('');
  const [cargando, establecerCargando] = useState(true);
  const [emitiendo, establecerEmitiendo] = useState(false);
  const [sesionVencida, establecerSesionVencida] = useState(false);
  const [ultimoTicket, establecerUltimoTicket] = useState<Ticket | null>(null);
  const [filtroSorteo, establecerFiltroSorteo] = useState('todos');
  const [horaVenezuela, establecerHoraVenezuela] = useState('');
  const [marcaHoraVenezuela, establecerMarcaHoraVenezuela] = useState(() => Date.now());
  const referenciaMonto = useRef<HTMLInputElement>(null);
  const referenciaAnimalManual = useRef<HTMLInputElement>(null);

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
    const actualizarHora = () => {
      const ahora = new Date();
      establecerHoraVenezuela(new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }).format(ahora));
      establecerMarcaHoraVenezuela(ahora.getTime());
    };
    actualizarHora();
    const intervalo = window.setInterval(actualizarHora, 10_000);
    return () => window.clearInterval(intervalo);
  }, []);
  const animalesPorId = useMemo(() => new Map(inicio?.animales.map((animal) => [animal.pk_animal, animal]) ?? []), [inicio]);
  const animalesOrdenados = useMemo(() => [...(inicio?.animales ?? [])].sort((primero, segundo) => Number.parseInt(primero.codigo_animal, 10) - Number.parseInt(segundo.codigo_animal, 10)), [inicio]);
  const animalesPorCodigo = useMemo(() => new Map(animalesOrdenados.map((animal) => [codigoAnimalComparable(animal.codigo_animal), animal])), [animalesOrdenados]);
  const horariosPorId = useMemo(() => new Map(inicio?.horarios.map((horario) => [horario.pk_horario_sorteo, horario]) ?? []), [inicio]);
  const minutosActuales = useMemo(() => minutosEnVenezuela(new Date(marcaHoraVenezuela)), [marcaHoraVenezuela]);
  const horariosDisponibles = useMemo(() => inicio?.horarios.filter((horario) => sigueDisponible(horario, inicio.agencia.minutos_cierre, minutosActuales)) ?? [], [inicio, minutosActuales]);
  const tiposSorteo = useMemo(() => [...new Set(horariosDisponibles.map((horario) => horario.sorteo))], [horariosDisponibles]);
  const horariosVisibles = filtroSorteo === 'todos' ? horariosDisponibles : horariosDisponibles.filter((horario) => horario.sorteo === filtroSorteo);
  const total = jugadas.reduce((acumulado, jugada) => acumulado + jugada.monto, 0);

  useEffect(() => {
    if (!mensaje) return undefined;
    const temporizador = window.setTimeout(() => establecerMensaje(''), 3_000);
    return () => window.clearTimeout(temporizador);
  }, [mensaje]);

  useEffect(() => {
    const idsDisponibles = new Set(horariosDisponibles.map((horario) => horario.pk_horario_sorteo));
    establecerHorarios((actuales) => actuales.filter((id) => idsDisponibles.has(id)));
    establecerJugadas((actuales) => actuales.filter((jugada) => idsDisponibles.has(jugada.fk_horario_sorteo)));
  }, [horariosDisponibles]);

  const alternar = (valor: number, valores: number[], establecer: (valores: number[]) => void) => establecer(valores.includes(valor) ? valores.filter((item) => item !== valor) : [...valores, valor]);
  function alternarAnimal(pk_animal: number) {
    alternar(pk_animal, animalesSeleccionados, establecerAnimales);
    window.requestAnimationFrame(() => referenciaMonto.current?.focus());
  }
  function alternarHorario(pkHorario: number) {
    alternar(pkHorario, horariosSeleccionados, establecerHorarios);
    window.requestAnimationFrame(() => referenciaAnimalManual.current?.focus());
  }
  function seleccionarAnimalManual() {
    const codigo = codigoAnimalComparable(codigoAnimalManual);
    const animal = animalesPorCodigo.get(codigo);
    if (!animal) { establecerMensaje(t('animal_no_disponible')); referenciaAnimalManual.current?.focus(); return; }
    if (animalesSeleccionados.includes(animal.pk_animal)) { establecerMensaje(t('animal_ya_seleccionado', { codigo: formatearCodigoAnimal(animal.codigo_animal) })); referenciaAnimalManual.current?.focus(); return; }
    establecerAnimales((actuales) => [...actuales, animal.pk_animal]);
    establecerCodigoAnimalManual(''); establecerMensaje('');
    window.requestAnimationFrame(() => referenciaMonto.current?.focus());
  }
  function limpiarJugadas() {
    establecerAnimales([]); establecerHorarios([]); establecerJugadas([]); establecerMonto('1'); establecerMensaje('');
    window.requestAnimationFrame(() => referenciaMonto.current?.focus());
  }
  function agregarJugada() {
    const montoNumerico = Number(monto.replace(',', '.'));
    if (!inicio) return;
    if (!animalesSeleccionados.length && !horariosSeleccionados.length) { establecerMensaje(t('selecciona_animal_y_sorteo')); referenciaAnimalManual.current?.focus(); return; }
    if (!animalesSeleccionados.length) { establecerMensaje(t('selecciona_animal')); referenciaAnimalManual.current?.focus(); return; }
    if (!horariosSeleccionados.length) { establecerMensaje(t('selecciona_sorteo')); return; }
    const montoMinimo = Math.max(1, inicio.agencia.jugada_minima);
    if (!Number.isFinite(montoNumerico) || montoNumerico < montoMinimo) { establecerMensaje(t('monto_minimo', { monto: montoMinimo.toFixed(2) })); return; }
    const nuevas = animalesSeleccionados.flatMap((fk_animal) => horariosSeleccionados.map((fk_horario_sorteo) => ({ fk_animal, fk_horario_sorteo, monto: montoNumerico })));
    establecerJugadas((actuales) => {
      const acumuladas = new Map(actuales.map((jugada) => [`${jugada.fk_animal}-${jugada.fk_horario_sorteo}`, jugada]));
      for (const jugada of nuevas) {
        const clave = `${jugada.fk_animal}-${jugada.fk_horario_sorteo}`;
        const anterior = acumuladas.get(clave);
        acumuladas.set(clave, anterior ? { ...anterior, monto: Math.round((anterior.monto + jugada.monto) * 100) / 100 } : jugada);
      }
      return [...acumuladas.values()];
    }); establecerAnimales([]); establecerHorarios([]); establecerMensaje('');
    window.requestAnimationFrame(() => referenciaAnimalManual.current?.focus());
  }
  function manejarTecla(evento: KeyboardEvent<HTMLInputElement>) { if (evento.key === 'Enter') { evento.preventDefault(); agregarJugada(); } }
  function manejarTeclaAnimal(evento: KeyboardEvent<HTMLInputElement>) { if (evento.key === 'Enter') { evento.preventDefault(); seleccionarAnimalManual(); } }
  function informarAccionTicket(accion: string) { establecerMensaje(t('accion_requiere_ticket', { accion })); }
  function imprimirTicket() {
    if (!jugadas.length && !ultimoTicket) { establecerMensaje(t('agrega_jugada_antes_imprimir')); return; }
    window.print();
  }
  async function emitir(evento: FormEvent) {
    evento.preventDefault(); if (!jugadas.length) { establecerMensaje(t('agrega_jugada_antes_emitir')); return; }
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
      <section className="tarjeta panel-operacion"><div className="monto-agregar"><label className="animal-manual">{t('animal_manual')}<input ref={referenciaAnimalManual} aria-label={t('animal_manual')} type="text" maxLength={2} inputMode="numeric" autoComplete="off" placeholder="00" value={codigoAnimalManual} onKeyDown={manejarTeclaAnimal} onChange={(evento) => { const valor = evento.target.value; if (/^\d{0,2}$/.test(valor)) establecerCodigoAnimalManual(valor); }} /></label><label>{t('monto')}<div className="campo-monto"><span>$</span><input ref={referenciaMonto} aria-label={t('monto')} type="number" min="1" step="0.01" inputMode="decimal" value={monto} onKeyDown={manejarTecla} onChange={(evento) => { const valor = evento.target.value; if (valor === '' || Number(valor) >= 1) establecerMonto(valor); }} onBlur={() => { if (!monto || Number(monto) < 1) establecerMonto('1'); }} /></div></label><button type="button" className="boton-secundario ancho-completo" onClick={agregarJugada}>{t('agregar')} ↵</button><button type="button" className="boton-secundario ancho-completo" onClick={imprimirTicket}>{t('imprimir')}</button></div><div className="titulo-panel"><h2>2. {t('sorteos')}</h2><span>{horariosSeleccionados.length} seleccionados</span></div><div className="filtros-sorteos" role="group" aria-label={t('filtrar_sorteos')}><button type="button" className={filtroSorteo === 'todos' ? 'activo' : ''} aria-pressed={filtroSorteo === 'todos'} onClick={() => establecerFiltroSorteo('todos')}>{t('todos')}</button>{tiposSorteo.map((sorteo) => <button type="button" key={sorteo} className={filtroSorteo === sorteo ? 'activo' : ''} aria-pressed={filtroSorteo === sorteo} onClick={() => establecerFiltroSorteo(sorteo)}>{sorteo}</button>)}</div><div className="lista-sorteos">{horariosVisibles.map((horario) => <label className={`opcion-sorteo ${horariosSeleccionados.includes(horario.pk_horario_sorteo) ? 'seleccionado' : ''}`} key={horario.pk_horario_sorteo}><input type="checkbox" checked={horariosSeleccionados.includes(horario.pk_horario_sorteo)} onChange={() => alternarHorario(horario.pk_horario_sorteo)} /><span><b>{horario.sorteo}</b><small>{horario.hora}</small></span></label>)}</div></section>
      <aside className="tarjeta panel-ticket"><div className="lista-jugadas">{jugadas.length === 0 ? <p className="vacio">{t('no_hay_jugadas')}</p> : jugadas.map((jugada, indice) => { const animal = animalesPorId.get(jugada.fk_animal); const horario = horariosPorId.get(jugada.fk_horario_sorteo); return <div className="fila-jugada" key={`${jugada.fk_animal}-${jugada.fk_horario_sorteo}`}><span className="detalle-jugada"><span>{animal?.icono} <b>{animal ? formatearCodigoAnimal(animal.codigo_animal) : ''}</b></span><span>{animal?.nombre}</span><small>{horario?.sorteo} {horario?.hora}</small></span><strong>${jugada.monto.toFixed(2)}</strong><button type="button" aria-label="Eliminar jugada" onClick={() => establecerJugadas(jugadas.filter((_, posicion) => posicion !== indice))}>×</button></div>; })}</div><div className="total total-superior"><span>Total ticket</span><strong>${total.toFixed(2)}</strong></div><button className="boton-primario ancho-completo" disabled={emitiendo}>{emitiendo ? '…' : t('emitir')}</button></aside>
    </form>
    <section className="acciones-ticket tarjeta" aria-label="Acciones de ticket">
      <button type="button" onClick={limpiarJugadas}>{t('limpiar_jugadas')}</button>
      <button type="button" onClick={() => informarAccionTicket('Repetir ticket')}>Repetir ticket</button>
      <button type="button" onClick={() => informarAccionTicket('Anular ticket')}>Anular ticket</button>
      <button type="button" onClick={() => informarAccionTicket('Pagar ticket')}>Pagar ticket</button>
    </section>
    <section className="ticket-pos" aria-hidden="true"><strong>AG · ANIMALITOS</strong><span>{inicio.agencia.nombre_agencia}</span><span>{new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</span><hr/>{ultimoTicket && <span>TN: {ultimoTicket.numero_ticket} · SN: {ultimoTicket.serial}</span>}{[...new Map(jugadas.map((jugada) => [jugada.fk_horario_sorteo, jugada])).values()].map((jugada) => { const horario = horariosPorId.get(jugada.fk_horario_sorteo); const items = jugadas.filter((item) => item.fk_horario_sorteo === jugada.fk_horario_sorteo); return <div key={jugada.fk_horario_sorteo}><b>{horario?.sorteo} {horario?.hora}</b><span>{items.map((item) => animalesPorId.get(item.fk_animal)?.nombre.slice(0, 4)).join(' - ')}</span><span>x{items[0].monto.toFixed(2)}</span></div>; })}<hr/><strong>Total: ${total.toFixed(2)}</strong></section>
    {mensaje && <div className="notificacion emergente" role="status">{mensaje}</div>}
    {ultimoTicket && <section className="recibo"><span>✓</span><div><strong>{t('ticket')} #{ultimoTicket.numero_ticket}</strong><p>Serial: {ultimoTicket.serial} · ${Number(ultimoTicket.total_jugado).toFixed(2)}</p></div></section>}
  </section>;
}
