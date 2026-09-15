import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';

type Animal = { pk_animal: number; codigo_animal: string; nombre: string; icono: string };
type Horario = { pk_horario_sorteo: number; hora: string; sorteo: string; disponible: boolean };
type Inicio = { agencia: { nombre_agencia: string; codigo_agencia: string; cupo_animal: number; jugada_minima: number; minutos_cierre: number; comision_porcentaje: number }; animales: Animal[]; horarios: Horario[]; multiplicador_premio: number };
type Jugada = { fk_animal: number; fk_horario_sorteo: number; monto: number };
type Ticket = { serial: string; numero_ticket: number; total_jugado: number };
type JugadaTicket = Jugada & { pk_jugada_ticket: string; animal?: { codigo_animal: string; nombre: string; icono: string }; horario_sorteo?: { hora: string; sorteo?: { nombre: string } } };
type TicketBuscado = { serial: string; numero_ticket: number; fecha_juego: string; total_jugado: string; jugadas: JugadaTicket[] };
type PagoConsultado = { serial: string; numero_ticket: number; fecha_juego: string; total_pagar: number; jugadas_premiadas: JugadaTicket[] };

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
function fechaCaracas() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date()); }

export function AgenciaVentasRuta({ token, alVencerSesion }: { token: string; alVencerSesion: () => void }) {
  const { t } = useTranslation();
  const [inicio, establecerInicio] = useState<Inicio | null>(null);
  const [animalesSeleccionados, establecerAnimales] = useState<number[]>([]);
  const [horariosSeleccionados, establecerHorarios] = useState<number[]>([]);
  const [monto, establecerMonto] = useState('1');
  const [codigoAnimalManual, establecerCodigoAnimalManual] = useState('');
  const [jugadas, establecerJugadas] = useState<Jugada[]>([]);
  const [jugadasUltimoTicket, establecerJugadasUltimoTicket] = useState<Jugada[]>([]);
  const [mensaje, establecerMensaje] = useState('');
  const [serialAnular, establecerSerialAnular] = useState('');
  const [anulando, establecerAnulando] = useState(false);
  const [mostrarAnular, establecerMostrarAnular] = useState(false);
  const [vistaPreviaTicket, establecerVistaPreviaTicket] = useState('');
  const [confirmarLimpieza, establecerConfirmarLimpieza] = useState(false);
  const [mostrarRepetir, establecerMostrarRepetir] = useState(false);
  const [fechaRepetir, establecerFechaRepetir] = useState(fechaCaracas);
  const [numeroRepetir, establecerNumeroRepetir] = useState('');
  const [ticketRepetir, establecerTicketRepetir] = useState<TicketBuscado | null>(null);
  const [jugadasRepetir, establecerJugadasRepetir] = useState<string[]>([]);
  const [buscandoRepetir, establecerBuscandoRepetir] = useState(false);
  const [mostrarPagar, establecerMostrarPagar] = useState(false);
  const [serialPagar, establecerSerialPagar] = useState('');
  const [pagoConsultado, establecerPagoConsultado] = useState<PagoConsultado | null>(null);
  const [consultandoPago, establecerConsultandoPago] = useState(false);
  const [pagando, establecerPagando] = useState(false);
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
  const jugadasParaImprimir = jugadas.length ? jugadas : jugadasUltimoTicket;
  const totalImprimible = jugadas.length ? total : Number(ultimoTicket?.total_jugado ?? total);
  const jugadasOrdenadas = useMemo(() => [...jugadas].sort((primera, segunda) => (horariosPorId.get(primera.fk_horario_sorteo)?.hora ?? '').localeCompare(horariosPorId.get(segunda.fk_horario_sorteo)?.hora ?? '')), [horariosPorId, jugadas]);
  const jugadasImprimiblesOrdenadas = useMemo(() => [...jugadasParaImprimir].sort((primera, segunda) => (horariosPorId.get(primera.fk_horario_sorteo)?.hora ?? '').localeCompare(horariosPorId.get(segunda.fk_horario_sorteo)?.hora ?? '')), [horariosPorId, jugadasParaImprimir]);

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
    window.requestAnimationFrame(() => (animalesSeleccionados.length ? referenciaMonto.current : referenciaAnimalManual.current)?.focus());
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
    window.requestAnimationFrame(() => referenciaAnimalManual.current?.focus());
  }
  function agregarJugadas(nuevas: Jugada[]) {
    establecerJugadas((actuales) => {
      const acumuladas = new Map(actuales.map((jugada) => [`${jugada.fk_animal}-${jugada.fk_horario_sorteo}`, jugada]));
      for (const jugada of nuevas) {
        const clave = `${jugada.fk_animal}-${jugada.fk_horario_sorteo}`;
        const anterior = acumuladas.get(clave);
        acumuladas.set(clave, anterior ? { ...anterior, monto: Math.round((anterior.monto + jugada.monto) * 100) / 100 } : jugada);
      }
      return [...acumuladas.values()];
    });
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
    agregarJugadas(nuevas); establecerAnimales([]); establecerHorarios([]); establecerMensaje('');
    window.requestAnimationFrame(() => referenciaAnimalManual.current?.focus());
  }
  function manejarTecla(evento: KeyboardEvent<HTMLInputElement>) { if (evento.key === 'Enter') { evento.preventDefault(); agregarJugada(); } }
  function manejarTeclaAnimal(evento: KeyboardEvent<HTMLInputElement>) { if (evento.key === 'Enter') { evento.preventDefault(); seleccionarAnimalManual(); } }
  function imprimirTicket() {
    if (!jugadasParaImprimir.length && !ultimoTicket) { establecerMensaje(t('agrega_jugada_antes_imprimir')); return; }
    const ordenadas = [...jugadasParaImprimir].sort((primera, segunda) => (horariosPorId.get(primera.fk_horario_sorteo)?.hora ?? '').localeCompare(horariosPorId.get(segunda.fk_horario_sorteo)?.hora ?? ''));
    const lineas = [...new Map(ordenadas.map((jugada) => [jugada.fk_horario_sorteo, jugada])).values()].flatMap((jugada) => {
      const horario = horariosPorId.get(jugada.fk_horario_sorteo);
      const items = ordenadas.filter((item) => item.fk_horario_sorteo === jugada.fk_horario_sorteo);
      return [`${horario?.sorteo ?? ''} ${horario?.hora ?? ''}`, items.map((item) => animalesPorId.get(item.fk_animal)?.nombre.slice(0, 4)).join(' - '), `x${items[0].monto.toFixed(2)}`];
    });
    const textoTicket = ['AG · ANIMALITOS', inicio?.agencia.nombre_agencia ?? '', new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' }).format(new Date()), '--------------------------------', ...(ultimoTicket ? [`TN: ${ultimoTicket.numero_ticket} · SN: ${ultimoTicket.serial}`] : []), ...lineas, '--------------------------------', `TOTAL: $${totalImprimible.toFixed(2)}`].join('\n');
    console.info('[AG · Animalitos] Contenido enviado a impresión', { ticket: textoTicket });
    console.log(textoTicket);
    establecerVistaPreviaTicket(textoTicket);
    window.print();
    establecerMensaje('Se abrió el selector de impresora del navegador.');
  }
  async function anularTicket(evento: FormEvent) {
    evento.preventDefault();
    if (!/^\d{8}$/.test(serialAnular)) { establecerMensaje('Ingresa el serial numérico de 8 dígitos.'); return; }
    establecerAnulando(true);
    try { const respuesta = await llamarApi<{ mensaje: string }>(`/agencia/tickets/${serialAnular}`, { method: 'DELETE' }, token); establecerMensaje(respuesta.mensaje); establecerSerialAnular(''); establecerMostrarAnular(false); }
    catch (error) { gestionarError(error); } finally { establecerAnulando(false); }
  }
  async function buscarTicketRepetir(evento: FormEvent) {
    evento.preventDefault();
    if (!numeroRepetir) { establecerMensaje('Ingresa el número del ticket.'); return; }
    establecerBuscandoRepetir(true);
    try { const ticket = await llamarApi<TicketBuscado>(`/agencia/tickets/buscar?fecha=${fechaRepetir}&numero=${numeroRepetir}`, {}, token); establecerTicketRepetir(ticket); establecerJugadasRepetir(ticket.jugadas.map((jugada) => jugada.pk_jugada_ticket)); }
    catch (error) { gestionarError(error); } finally { establecerBuscandoRepetir(false); }
  }
  function usarTicketRepetido() {
    if (!ticketRepetir) return;
    const horarioDestino = (jugada: JugadaTicket) => horariosDisponibles.find((horario) => horario.sorteo === jugada.horario_sorteo?.sorteo?.nombre);
    const seleccionadas = ticketRepetir.jugadas.filter((jugada) => jugadasRepetir.includes(jugada.pk_jugada_ticket) && horarioDestino(jugada));
    if (!seleccionadas.length) { establecerMensaje('No hay jugadas seleccionadas con sorteos disponibles para repetir.'); return; }
    agregarJugadas(seleccionadas.map((jugada) => ({ fk_animal: jugada.fk_animal, fk_horario_sorteo: horarioDestino(jugada)!.pk_horario_sorteo, monto: Number(jugada.monto) })));
    establecerMostrarRepetir(false); establecerMensaje(`${seleccionadas.length} jugada(s) agregada(s) al ticket actual.`); window.requestAnimationFrame(() => referenciaAnimalManual.current?.focus());
  }
  async function consultarPago(evento: FormEvent) {
    evento.preventDefault();
    if (!/^\d{8}$/.test(serialPagar)) { establecerMensaje('Ingresa el serial numérico de 8 dígitos.'); return; }
    establecerConsultandoPago(true);
    try { establecerPagoConsultado(await llamarApi<PagoConsultado>(`/agencia/tickets/${serialPagar}/pago`, {}, token)); }
    catch (error) { gestionarError(error); } finally { establecerConsultandoPago(false); }
  }
  async function pagarTicket() {
    if (!pagoConsultado?.total_pagar) { establecerMensaje('Este ticket no tiene premios por pagar.'); return; }
    establecerPagando(true);
    try { const respuesta = await llamarApi<{ mensaje: string }>(`/agencia/tickets/${pagoConsultado.serial}/pagar`, { method: 'POST' }, token); establecerMensaje(respuesta.mensaje); establecerMostrarPagar(false); establecerPagoConsultado(null); establecerSerialPagar(''); }
    catch (error) { gestionarError(error); } finally { establecerPagando(false); }
  }
  async function emitir(evento: FormEvent) {
    evento.preventDefault(); if (!jugadas.length) { establecerMensaje(t('agrega_jugada_antes_emitir')); return; }
    establecerEmitiendo(true); establecerMensaje('');
    try { const ticket = await llamarApi<Ticket>('/agencia/tickets', { method: 'POST', body: JSON.stringify({ jugadas }) }, token); establecerUltimoTicket(ticket); establecerJugadasUltimoTicket(jugadas); establecerJugadas([]); establecerMensaje(t('venta_exitosa')); }
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
      <aside className="tarjeta panel-ticket"><div className="lista-jugadas">{jugadas.length === 0 ? <p className="vacio">{t('no_hay_jugadas')}</p> : jugadasOrdenadas.map((jugada) => { const animal = animalesPorId.get(jugada.fk_animal); const horario = horariosPorId.get(jugada.fk_horario_sorteo); return <div className="fila-jugada" key={`${jugada.fk_animal}-${jugada.fk_horario_sorteo}`}><span className="detalle-jugada"><span>{animal?.icono} <b>{animal ? formatearCodigoAnimal(animal.codigo_animal) : ''}</b></span><span>{animal?.nombre}</span><small>{horario?.sorteo} {horario?.hora}</small></span><strong>${jugada.monto.toFixed(2)}</strong><button type="button" aria-label="Eliminar jugada" onClick={() => establecerJugadas((actuales) => actuales.filter((item) => item.fk_animal !== jugada.fk_animal || item.fk_horario_sorteo !== jugada.fk_horario_sorteo))}>×</button></div>; })}</div><div className="total total-superior"><span>Total ticket</span><strong>${total.toFixed(2)}</strong></div><button className="boton-primario ancho-completo" disabled={emitiendo}>{emitiendo ? '…' : t('emitir')}</button></aside>
    </form>
    <section className="acciones-ticket tarjeta" aria-label="Acciones de ticket">
      <button type="button" onClick={() => jugadas.length ? establecerConfirmarLimpieza(true) : establecerMensaje('No hay jugadas para limpiar.')}>{t('limpiar_jugadas')}</button>
      <button type="button" onClick={() => establecerMostrarRepetir(true)}>Repetir ticket</button>
      <button type="button" onClick={() => establecerMostrarAnular(true)}>Anular ticket</button>
      <button type="button" onClick={() => establecerMostrarPagar(true)}>Pagar ticket</button>
    </section>
    <section className="ticket-pos" aria-hidden="true"><strong>AG · ANIMALITOS</strong><span>{inicio.agencia.nombre_agencia}</span><span>{new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</span><hr/>{ultimoTicket && <span>TN: {ultimoTicket.numero_ticket} · SN: {ultimoTicket.serial}</span>}{[...new Map(jugadasImprimiblesOrdenadas.map((jugada) => [jugada.fk_horario_sorteo, jugada])).values()].map((jugada) => { const horario = horariosPorId.get(jugada.fk_horario_sorteo); const items = jugadasImprimiblesOrdenadas.filter((item) => item.fk_horario_sorteo === jugada.fk_horario_sorteo); return <div key={jugada.fk_horario_sorteo}><b>{horario?.sorteo} {horario?.hora}</b><span>{items.map((item) => animalesPorId.get(item.fk_animal)?.nombre.slice(0, 4)).join(' - ')}</span><span>x{items[0].monto.toFixed(2)}</span></div>; })}<hr/><strong>Total: ${totalImprimible.toFixed(2)}</strong></section>
    {mensaje && <div className="notificacion emergente" role="status">{mensaje}</div>}
    {confirmarLimpieza && <div className="fondo-consulta"><section className="ventana-consulta tarjeta confirmacion-accion" role="dialog" aria-modal="true" aria-label="Confirmar limpieza"><header className="encabezado-consulta"><h2>Limpiar jugadas</h2><button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerConfirmarLimpieza(false)}>×</button></header><p>Se eliminarán todas las jugadas que aún no se han emitido. Esta acción no afecta tickets vendidos.</p><div className="acciones-modal"><button type="button" className="boton-secundario" onClick={() => establecerConfirmarLimpieza(false)}>Cancelar</button><button type="button" className="boton-primario" onClick={() => { limpiarJugadas(); establecerConfirmarLimpieza(false); }}>Sí, limpiar</button></div></section></div>}
    {mostrarAnular && <div className="fondo-consulta"><form className="ventana-consulta tarjeta formulario-anular" onSubmit={anularTicket}><header className="encabezado-consulta"><h2>Anular ticket</h2><button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerMostrarAnular(false)}>×</button></header><p>Escribe el serial numérico de 8 dígitos del ticket que deseas anular.</p><label>Serial del ticket<input value={serialAnular} inputMode="numeric" maxLength={8} autoFocus onChange={(evento) => establecerSerialAnular(evento.target.value.replace(/\D/g, ''))} placeholder="12345678" /></label><button className="boton-primario" disabled={anulando}>{anulando ? '…' : 'Anular ticket'}</button></form></div>}
    {mostrarRepetir && <div className="fondo-consulta"><section className="ventana-consulta tarjeta modal-repetir" role="dialog" aria-modal="true" aria-label="Repetir ticket"><header className="encabezado-consulta"><h2>Repetir ticket</h2><button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerMostrarRepetir(false)}>×</button></header><form className="formulario-busqueda-ticket" onSubmit={buscarTicketRepetir}><label>Fecha<input type="date" value={fechaRepetir} onChange={(evento) => establecerFechaRepetir(evento.target.value)} required /></label><label>Número de ticket<input type="number" min="1" inputMode="numeric" value={numeroRepetir} onChange={(evento) => establecerNumeroRepetir(evento.target.value)} placeholder="Ej. 25" required /></label><button className="boton-secundario" disabled={buscandoRepetir}>{buscandoRepetir ? 'Buscando…' : 'Buscar'}</button></form>{ticketRepetir && <div className="resultado-repetir"><div className="datos-ticket-repetir"><span>Ticket #{ticketRepetir.numero_ticket}</span><span>Serial {ticketRepetir.serial}</span><strong>${Number(ticketRepetir.total_jugado).toFixed(2)}</strong></div><p>Elige las jugadas que deseas utilizar. Cada una se programa en el próximo horario disponible de su mismo sorteo.</p><div className="selecciones-repetir">{[...ticketRepetir.jugadas].sort((primera, segunda) => (primera.horario_sorteo?.hora ?? '').localeCompare(segunda.horario_sorteo?.hora ?? '')).map((jugada) => { const destino = horariosDisponibles.find((horario) => horario.sorteo === jugada.horario_sorteo?.sorteo?.nombre); return <label className={`seleccion-jugada ${destino ? '' : 'no-disponible'}`} key={jugada.pk_jugada_ticket}><input type="checkbox" checked={jugadasRepetir.includes(jugada.pk_jugada_ticket)} disabled={!destino} onChange={() => establecerJugadasRepetir((actuales) => actuales.includes(jugada.pk_jugada_ticket) ? actuales.filter((id) => id !== jugada.pk_jugada_ticket) : [...actuales, jugada.pk_jugada_ticket])} /><span><b>{jugada.horario_sorteo?.sorteo?.nombre} · {destino ? destino.hora : 'sin próximo horario'}</b><small>{formatearCodigoAnimal(jugada.animal?.codigo_animal ?? '')} · {jugada.animal?.nombre}{destino && destino.hora !== jugada.horario_sorteo?.hora ? ` · antes ${jugada.horario_sorteo?.hora}` : ''}</small></span><strong>${Number(jugada.monto).toFixed(2)}</strong></label>; })}</div><div className="acciones-modal"><button type="button" className="boton-secundario" onClick={() => establecerMostrarRepetir(false)}>Cancelar</button><button type="button" className="boton-primario" disabled={!jugadasRepetir.length} onClick={usarTicketRepetido}>Utilizar este ticket</button></div></div>}</section></div>}
    {mostrarPagar && <div className="fondo-consulta"><section className="ventana-consulta tarjeta modal-pagar" role="dialog" aria-modal="true" aria-label="Pagar ticket"><header className="encabezado-consulta"><h2>Pagar ticket</h2><button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => { establecerMostrarPagar(false); establecerPagoConsultado(null); }}>×</button></header>{!pagoConsultado ? <form className="formulario-busqueda-ticket formulario-pago" onSubmit={consultarPago}><label>Serial del ticket<input value={serialPagar} inputMode="numeric" maxLength={8} autoFocus onChange={(evento) => establecerSerialPagar(evento.target.value.replace(/\D/g, ''))} placeholder="12345678" required /></label><button className="boton-secundario" disabled={consultandoPago}>{consultandoPago ? 'Consultando…' : 'Consultar'}</button></form> : <div className="resultado-pago"><div className="datos-ticket-repetir"><span>Ticket #{pagoConsultado.numero_ticket}</span><span>{pagoConsultado.fecha_juego}</span><strong>${pagoConsultado.total_pagar.toFixed(2)}</strong></div>{pagoConsultado.total_pagar > 0 ? <><p>Premios encontrados para este ticket:</p><div className="selecciones-repetir">{[...pagoConsultado.jugadas_premiadas].sort((primera, segunda) => (primera.horario_sorteo?.hora ?? '').localeCompare(segunda.horario_sorteo?.hora ?? '')).map((jugada) => <div className="seleccion-jugada premio" key={jugada.pk_jugada_ticket}><span><b>{jugada.horario_sorteo?.hora} · {jugada.horario_sorteo?.sorteo?.nombre}</b><small>{formatearCodigoAnimal(jugada.animal?.codigo_animal ?? '')} · {jugada.animal?.nombre}</small></span><strong>${(Number(jugada.monto) * inicio.multiplicador_premio).toFixed(2)}</strong></div>)}</div><div className="acciones-modal"><button type="button" className="boton-secundario" onClick={() => { establecerMostrarPagar(false); establecerPagoConsultado(null); }}>Cancelar</button><button type="button" className="boton-primario" disabled={pagando} onClick={pagarTicket}>{pagando ? 'Pagando…' : `Pagar $${pagoConsultado.total_pagar.toFixed(2)}`}</button></div></> : <><p className="sin-premio">Este ticket no tiene jugadas premiadas para pagar.</p><div className="acciones-modal"><button type="button" className="boton-secundario" onClick={() => { establecerMostrarPagar(false); establecerPagoConsultado(null); }}>Cerrar</button></div></>}</div>}</section></div>}
    {vistaPreviaTicket && <div className="fondo-consulta"><section className="vista-ticket tarjeta" role="dialog" aria-modal="true" aria-label="Vista previa del ticket"><header className="encabezado-consulta"><h2>Vista previa</h2><button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerVistaPreviaTicket('')}>×</button></header><pre>{vistaPreviaTicket}</pre><button type="button" className="boton-primario" onClick={() => establecerVistaPreviaTicket('')}>Listo</button></section></div>}
  </section>;
}
