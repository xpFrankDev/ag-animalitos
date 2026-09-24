import { FocusEvent, FormEvent, KeyboardEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';
import { fechaCaracas } from '../../compartido/utilidades/formato';
import { componerTicket } from './ticket';
import type {
  CupoCombinacion,
  Horario,
  Inicio,
  Jugada,
  JugadaTicket,
  PagoConsultado,
  Ticket,
  TicketBuscado,
  VerificacionCupo,
} from './ventas.tipos';
import { claveCupo, codigoAnimalComparable, formatearCodigoAnimal, minutosEnVenezuela, sigueDisponible, valorCodigoAnimal } from './utilidades';

type Propiedades = { token: string; alVencerSesion: () => void };

/** El error de red no es un ErrorApi: sirve para distinguir "sin conexión" de un rechazo del servidor. */
function esFalloDeRed(error: unknown): boolean {
  return !(error instanceof ErrorApi);
}

export function AgenciaVentasRuta({ token, alVencerSesion }: Propiedades) {
  const { t } = useTranslation();
  const [inicio, establecerInicio] = useState<Inicio | null>(null);
  const [animalesSeleccionados, establecerAnimales] = useState<number[]>([]);
  const [horariosSeleccionados, establecerHorarios] = useState<number[]>([]);
  const [pkGrupoActivo, establecerPkGrupoActivo] = useState<number | null>(null);
  const [monto, establecerMonto] = useState('1');
  const [codigoAnimalManual, establecerCodigoAnimalManual] = useState('');
  const [jugadas, establecerJugadas] = useState<Jugada[]>([]);
  const [jugadasUltimoTicket, establecerJugadasUltimoTicket] = useState<Jugada[]>([]);
  const [cupos, establecerCupos] = useState<Map<string, CupoCombinacion>>(() => new Map());
  const [mensaje, establecerMensaje] = useState('');
  const [serialAnular, establecerSerialAnular] = useState('');
  const [anulando, establecerAnulando] = useState(false);
  const [mostrarAnular, establecerMostrarAnular] = useState(false);
  const [vistaPreviaTicket, establecerVistaPreviaTicket] = useState('');
  const [confirmarLimpieza, establecerConfirmarLimpieza] = useState(false);
  const [validandoCupo, establecerValidandoCupo] = useState(false);
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
  const [verificando, establecerVerificando] = useState(false);
  const [sesionVencida, establecerSesionVencida] = useState(false);
  const [ultimoTicket, establecerUltimoTicket] = useState<Ticket | null>(null);
  const [filtroSorteo, establecerFiltroSorteo] = useState('todos');
  const [horaVenezuela, establecerHoraVenezuela] = useState('');
  const [marcaHoraVenezuela, establecerMarcaHoraVenezuela] = useState(() => Date.now());
  const referenciaMonto = useRef<HTMLInputElement>(null);
  const referenciaAnimalManual = useRef<HTMLInputElement>(null);
  /** El primer clic dentro del monto no debe deshacer la selección completa del foco. */
  const conservarSeleccionMonto = useRef(false);

  const registrarCupos = useCallback((detalle: CupoCombinacion[]) => {
    if (!detalle.length) return;
    establecerCupos((actuales) => {
      const siguientes = new Map(actuales);
      for (const item of detalle) siguientes.set(claveCupo(item.fk_animal, item.fk_horario_sorteo), item);
      return siguientes;
    });
  }, []);

  const gestionarError = useCallback(
    (error: unknown) => {
      if (error instanceof ErrorApi && error.estado === 401) {
        establecerSesionVencida(true);
        return;
      }
      establecerMensaje(esFalloDeRed(error) ? t('sin_conexion') : error instanceof Error ? error.message : t('error_generico'));
    },
    [t],
  );

  useEffect(() => {
    void llamarApi<Inicio>('/agencia/inicio', {}, token)
      .then(establecerInicio)
      .catch(gestionarError)
      .finally(() => establecerCargando(false));
  }, [token, gestionarError]);

  useEffect(() => {
    if (!sesionVencida) return undefined;
    const temporizador = window.setTimeout(alVencerSesion, 2_500);
    return () => window.clearTimeout(temporizador);
  }, [sesionVencida, alVencerSesion]);

  useEffect(() => {
    const actualizarHora = () => {
      const ahora = new Date();
      establecerHoraVenezuela(
        new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit' }).format(ahora),
      );
      establecerMarcaHoraVenezuela(ahora.getTime());
    };
    actualizarHora();
    const intervalo = window.setInterval(actualizarHora, 10_000);
    return () => window.clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!mensaje) return undefined;
    const temporizador = window.setTimeout(() => establecerMensaje(''), 4_000);
    return () => window.clearTimeout(temporizador);
  }, [mensaje]);

  const animalesPorId = useMemo(() => new Map(inicio?.animales.map((animal) => [animal.pk_animal, animal]) ?? []), [inicio]);
  /** Lista de animales de cada grupo: la taquilla solo dibuja la del sorteo elegido. */
  const gruposPorId = useMemo(() => new Map((inicio?.grupos ?? []).map((grupo) => [grupo.pk_grupo_animales, grupo])), [inicio]);
  const grupoActivo = (pkGrupoActivo === null ? undefined : gruposPorId.get(pkGrupoActivo)) ?? inicio?.grupos[0];
  const animalesOrdenados = useMemo(() => {
    const ids = grupoActivo ? new Set(grupoActivo.animales) : null;
    return [...(inicio?.animales ?? [])]
      .filter((animal) => !ids || ids.has(animal.pk_animal))
      .sort((primero, segundo) => valorCodigoAnimal(primero.codigo_animal) - valorCodigoAnimal(segundo.codigo_animal));
  }, [inicio, grupoActivo]);
  const animalesPorCodigo = useMemo(
    () => new Map(animalesOrdenados.map((animal) => [codigoAnimalComparable(animal.codigo_animal), animal])),
    [animalesOrdenados],
  );
  const catalogoPorCodigo = useMemo(
    () => new Map((inicio?.animales ?? []).map((animal) => [codigoAnimalComparable(animal.codigo_animal), animal])),
    [inicio],
  );
  /** Grupo de cada animal del catálogo: permite decir en qué lista sí participa un código. */
  const grupoPorAnimal = useMemo(
    () => new Map((inicio?.grupos ?? []).flatMap((grupo) => grupo.animales.map((pk_animal) => [pk_animal, grupo.nombre] as const))),
    [inicio],
  );
  const horariosPorId = useMemo(() => new Map(inicio?.horarios.map((horario) => [horario.pk_horario_sorteo, horario]) ?? []), [inicio]);
  const minutosActuales = useMemo(() => minutosEnVenezuela(new Date(marcaHoraVenezuela)), [marcaHoraVenezuela]);
  const horariosDisponibles = useMemo(
    () => inicio?.horarios.filter((horario) => sigueDisponible(horario, inicio.agencia.minutos_cierre, minutosActuales)) ?? [],
    [inicio, minutosActuales],
  );
  const tiposSorteo = useMemo(() => [...new Set(horariosDisponibles.map((horario) => horario.sorteo))], [horariosDisponibles]);
  const horariosVisibles = filtroSorteo === 'todos' ? horariosDisponibles : horariosDisponibles.filter((horario) => horario.sorteo === filtroSorteo);
  const cupoDeJugada = useCallback(
    (jugada: Jugada) => cupos.get(claveCupo(jugada.fk_animal, jugada.fk_horario_sorteo)),
    [cupos],
  );
  /** Una combinación sin cupo queda en 0: no se imprime, no se cuenta y no se vende. */
  const montoVendible = useCallback(
    (jugada: Jugada) => (cupoDeJugada(jugada)?.excedido ? 0 : jugada.monto),
    [cupoDeJugada],
  );
  const jugadasVendibles = useMemo(() => jugadas.filter((jugada) => montoVendible(jugada) > 0), [jugadas, montoVendible]);
  const jugadasSinCupo = jugadas.length - jugadasVendibles.length;
  const total = jugadasVendibles.reduce((acumulado, jugada) => acumulado + jugada.monto, 0);
  const jugadasParaImprimir = jugadas.length ? jugadasVendibles : jugadasUltimoTicket;
  const ordenarPorHora = useCallback(
    (lista: Jugada[]) =>
      [...lista].sort((primera, segunda) =>
        (horariosPorId.get(primera.fk_horario_sorteo)?.hora ?? '').localeCompare(horariosPorId.get(segunda.fk_horario_sorteo)?.hora ?? ''),
      ),
    [horariosPorId],
  );
  const jugadasOrdenadas = useMemo(() => ordenarPorHora(jugadas), [jugadas, ordenarPorHora]);
  const jugadasImprimiblesOrdenadas = useMemo(() => ordenarPorHora(jugadasParaImprimir), [jugadasParaImprimir, ordenarPorHora]);
  /**
   * La tirilla se compone una sola vez: el mismo texto alimenta la vista previa,
   * el registro de consola y el documento que recibe la impresora.
   */
  const ticketImpresion = useMemo(
    () =>
      componerTicket({
        agencia: inicio?.agencia.nombre_agencia ?? '',
        codigoAgencia: inicio?.agencia.codigo_agencia ?? '',
        numeroTicket: ultimoTicket?.numero_ticket,
        serial: ultimoTicket?.serial,
        saltosLinea: inicio?.agencia.salto_linea,
        jugadas: jugadasImprimiblesOrdenadas,
        animales: animalesPorId,
        horarios: horariosPorId,
        etiquetas: { monto: t('ticket_monto_abrev'), jugadas: t('ticket_jugadas_abrev') },
      }),
    [inicio, ultimoTicket, jugadasImprimiblesOrdenadas, animalesPorId, horariosPorId, t],
  );

  useEffect(() => {
    const idsDisponibles = new Set(horariosDisponibles.map((horario) => horario.pk_horario_sorteo));
    establecerHorarios((actuales) => actuales.filter((id) => idsDisponibles.has(id)));
    establecerJugadas((actuales) => actuales.filter((jugada) => idsDisponibles.has(jugada.fk_horario_sorteo)));
  }, [horariosDisponibles]);

  /**
   * Cada jugada del borrador se valida contra el cupo de la agencia y el del grupero:
   * así el cupo se descuenta mientras se arma el ticket y no recién al imprimir.
   */
  const validarCupoBorrador = useCallback(
    async (borrador: Jugada[]) => {
      establecerValidandoCupo(true);
      try {
        const verificacion = await llamarApi<VerificacionCupo>(
          '/agencia/tickets/validar',
          { method: 'POST', body: JSON.stringify({ jugadas: borrador }) },
          token,
        );
        registrarCupos(verificacion.detalle);
      } catch (error) {
        if (error instanceof ErrorApi && error.estado === 401) {
          establecerSesionVencida(true);
          return;
        }
        // Sin conexión no se bloquea el armado: la validación definitiva ocurre al emitir.
      } finally {
        establecerValidandoCupo(false);
      }
    },
    [token, registrarCupos],
  );

  useEffect(() => {
    if (!jugadas.length) return undefined;
    const temporizador = window.setTimeout(() => void validarCupoBorrador(jugadas), 300);
    return () => window.clearTimeout(temporizador);
  }, [jugadas, validarCupoBorrador]);

  const alternar = (valor: number, valores: number[], establecer: (valores: number[]) => void) =>
    establecer(valores.includes(valor) ? valores.filter((item) => item !== valor) : [...valores, valor]);

  function alternarAnimal(pk_animal: number) {
    alternar(pk_animal, animalesSeleccionados, establecerAnimales);
    window.requestAnimationFrame(() => referenciaMonto.current?.focus());
  }

  /**
   * Los sortejos de listas distintas no conviven en un mismo ticket: al marcar un sorteo de
   * otra lista se reemplaza la selección anterior para que la retícula dibuje la nueva.
   */
  function alternarHorario(horario: Horario) {
    const yaSeleccionado = horariosSeleccionados.includes(horario.pk_horario_sorteo);
    if (yaSeleccionado) {
      establecerHorarios(horariosSeleccionados.filter((id) => id !== horario.pk_horario_sorteo));
    } else if (grupoActivo && horario.fk_grupo_animales !== grupoActivo.pk_grupo_animales) {
      cambiarLista(horario.fk_grupo_animales);
      establecerHorarios([horario.pk_horario_sorteo]);
    } else {
      establecerHorarios([...horariosSeleccionados, horario.pk_horario_sorteo]);
      establecerPkGrupoActivo(horario.fk_grupo_animales);
    }
    window.requestAnimationFrame(() => (animalesSeleccionados.length ? referenciaMonto.current : referenciaAnimalManual.current)?.focus());
  }

  /**
   * Cambia la lista de animales dibujada en la taquilla. Si venía de otra lista se limpian
   * las selecciones (animales y sorteos) para que nunca queden mezcladas.
   */
  function cambiarLista(fk_grupo_animales: number) {
    const grupo = gruposPorId.get(fk_grupo_animales);
    if (!grupo || grupo.pk_grupo_animales === grupoActivo?.pk_grupo_animales) return;
    establecerPkGrupoActivo(fk_grupo_animales);
    establecerAnimales([]);
    establecerHorarios([]);
    establecerMensaje(t('lista_cambiada', { lista: grupo.nombre }));
  }

  /**
   * Los botones de cada sorteo filtran el listado y, además, dejan su lista de animales
   * dibujada: es el mismo comportamiento que marcar un sorteo desde «Todos».
   */
  function filtrarSorteo(sorteo: string) {
    establecerFiltroSorteo(sorteo);
    if (sorteo === 'todos') return;
    const horario = horariosDisponibles.find((item) => item.sorteo === sorteo);
    if (horario) cambiarLista(horario.fk_grupo_animales);
  }

  function seleccionarAnimalManual() {
    const codigo = codigoAnimalComparable(codigoAnimalManual);
    const animal = animalesPorCodigo.get(codigo);
    if (!animal) {
      const otro = catalogoPorCodigo.get(codigo);
      const lista = otro ? grupoPorAnimal.get(otro.pk_animal) : undefined;
      establecerMensaje(
        otro && lista && lista !== grupoActivo?.nombre
          ? t('animal_de_otra_lista', { codigo: formatearCodigoAnimal(otro.codigo_animal), lista })
          : t('animal_no_disponible'),
      );
      referenciaAnimalManual.current?.focus();
      return;
    }
    if (animalesSeleccionados.includes(animal.pk_animal)) {
      establecerMensaje(t('animal_ya_seleccionado', { codigo: formatearCodigoAnimal(animal.codigo_animal) }));
      referenciaAnimalManual.current?.focus();
      return;
    }
    establecerAnimales((actuales) => [...actuales, animal.pk_animal]);
    establecerCodigoAnimalManual('');
    establecerMensaje('');
    window.requestAnimationFrame(() => referenciaMonto.current?.focus());
  }

  /** Quita el animal elegido sin tocar los sorteos: así se cargan varios animales al mismo horario. */
  function limpiarAnimales() {
    establecerAnimales([]);
    window.requestAnimationFrame(() => referenciaAnimalManual.current?.focus());
  }

  /** Deja el selector listo para la próxima jugada: sin animales ni sorteos marcados. */
  function reiniciarSeleccion() {
    limpiarAnimales();
    establecerHorarios([]);
  }

  function limpiarJugadas() {
    reiniciarSeleccion();
    establecerJugadas([]);
    establecerMonto('1');
    establecerMensaje('');
  }

  function agregarJugadas(nuevas: Jugada[]) {
    establecerJugadas((actuales) => {
      const acumuladas = new Map(actuales.map((jugada) => [claveCupo(jugada.fk_animal, jugada.fk_horario_sorteo), jugada]));
      for (const jugada of nuevas) {
        const clave = claveCupo(jugada.fk_animal, jugada.fk_horario_sorteo);
        const anterior = acumuladas.get(clave);
        acumuladas.set(clave, anterior ? { ...anterior, monto: Math.round((anterior.monto + jugada.monto) * 100) / 100 } : jugada);
      }
      return [...acumuladas.values()];
    });
  }

  function agregarJugada() {
    const montoNumerico = Number(monto.replace(',', '.'));
    if (!inicio) return;
    if (!animalesSeleccionados.length && !horariosSeleccionados.length) {
      establecerMensaje(t('selecciona_animal_y_sorteo'));
      referenciaAnimalManual.current?.focus();
      return;
    }
    if (!animalesSeleccionados.length) {
      establecerMensaje(t('selecciona_animal'));
      referenciaAnimalManual.current?.focus();
      return;
    }
    if (!horariosSeleccionados.length) {
      establecerMensaje(t('selecciona_sorteo'));
      return;
    }
    const montoMinimo = Math.max(1, inicio.agencia.jugada_minima);
    if (!Number.isFinite(montoNumerico) || montoNumerico < montoMinimo) {
      establecerMensaje(t('monto_minimo', { monto: montoMinimo.toFixed(2) }));
      return;
    }
    const nuevas = animalesSeleccionados.flatMap((fk_animal) =>
      horariosSeleccionados.map((fk_horario_sorteo) => ({ fk_animal, fk_horario_sorteo, monto: montoNumerico })),
    );
    agregarJugadas(nuevas);
    // Los sorteos se conservan: el operador suele cargar varios animales con el mismo horario.
    limpiarAnimales();
    establecerMensaje('');
  }

  function manejarTecla(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      agregarJugada();
    }
  }

  function manejarTeclaAnimal(evento: KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      seleccionarAnimalManual();
    }
  }

  /** Al recibir el foco se marca todo el monto: al escribir un valor nuevo reemplaza el anterior. */
  function seleccionarMontoAlEnfocar(evento: FocusEvent<HTMLInputElement>) {
    evento.currentTarget.select();
    conservarSeleccionMonto.current = true;
  }

  function conservarSeleccionAlSoltar(evento: MouseEvent<HTMLInputElement>) {
    if (!conservarSeleccionMonto.current) return;
    evento.preventDefault();
    conservarSeleccionMonto.current = false;
  }

  /**
   * La impresión depende del cupo: si el servidor no responde, no se imprime.
   * La verificación devuelve además el cupo vigente de agencia y grupero.
   */
  async function imprimirTicket() {
    const hayBorrador = jugadas.length > 0;
    if (hayBorrador ? !jugadasVendibles.length : !ultimoTicket) {
      establecerMensaje(hayBorrador ? t('sin_jugadas_con_cupo') : t('agrega_jugada_antes_imprimir'));
      return;
    }
    establecerVerificando(true);
    try {
      const cuerpo = hayBorrador ? { jugadas: jugadasVendibles } : { serial: ultimoTicket!.serial };
      const verificacion = await llamarApi<VerificacionCupo>('/agencia/tickets/validar', { method: 'POST', body: JSON.stringify(cuerpo) }, token);
      registrarCupos(verificacion.detalle);
      if (!verificacion.puede_emitir) {
        establecerMensaje(verificacion.mensaje ?? t('cupo_agotado'));
        return;
      }
      console.info('[AG · Animalitos] Contenido enviado a impresión', { ticket: ticketImpresion });
      establecerVistaPreviaTicket(ticketImpresion);
      window.print();
      establecerMensaje(t('abriendo_impresora'));
      reiniciarSeleccion();
    } catch (error) {
      if (error instanceof ErrorApi && error.estado === 401) {
        establecerSesionVencida(true);
        return;
      }
      establecerMensaje(esFalloDeRed(error) ? t('sin_conexion_impresion') : error instanceof Error ? error.message : t('error_generico'));
    } finally {
      establecerVerificando(false);
    }
  }

  async function anularTicket(evento: FormEvent) {
    evento.preventDefault();
    if (!/^\d{8}$/.test(serialAnular)) {
      establecerMensaje(t('serial_invalido'));
      return;
    }
    establecerAnulando(true);
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/agencia/tickets/${serialAnular}`, { method: 'DELETE' }, token);
      establecerMensaje(respuesta.mensaje);
      establecerSerialAnular('');
      establecerMostrarAnular(false);
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerAnulando(false);
    }
  }

  async function buscarTicketRepetir(evento: FormEvent) {
    evento.preventDefault();
    if (!numeroRepetir) {
      establecerMensaje(t('numero_invalido'));
      return;
    }
    establecerBuscandoRepetir(true);
    establecerTicketRepetir(null);
    establecerJugadasRepetir([]);
    try {
      const ticket = await llamarApi<TicketBuscado>(`/agencia/tickets/buscar?fecha=${fechaRepetir}&numero=${numeroRepetir}`, {}, token);
      establecerTicketRepetir(ticket);
      establecerJugadasRepetir(ticket.jugadas.map((jugada) => jugada.pk_jugada_ticket));
    } catch (error) {
      establecerTicketRepetir(null);
      gestionarError(error);
    } finally {
      establecerBuscandoRepetir(false);
    }
  }

  /** Abre el buscador de tickets repetidos sin la información de la consulta anterior. */
  function abrirRepetir() {
    establecerTicketRepetir(null);
    establecerJugadasRepetir([]);
    establecerNumeroRepetir('');
    establecerMostrarRepetir(true);
  }

  /** Cierra el buscador y descarta el ticket consultado para no reutilizar datos viejos. */
  function cerrarRepetir() {
    establecerMostrarRepetir(false);
    establecerTicketRepetir(null);
    establecerJugadasRepetir([]);
  }

  function usarTicketRepetido() {
    if (!ticketRepetir) return;
    const horarioDestino = (jugada: JugadaTicket) => horariosDisponibles.find((horario) => horario.sorteo === jugada.horario_sorteo?.sorteo?.nombre);
    const seleccionadas = ticketRepetir.jugadas.filter((jugada) => jugadasRepetir.includes(jugada.pk_jugada_ticket) && horarioDestino(jugada));
    if (!seleccionadas.length) {
      establecerMensaje(t('sin_jugadas_para_repetir'));
      return;
    }
    const destinos = seleccionadas.map((jugada) => horarioDestino(jugada)!);
    const gruposDestino = new Set(destinos.map((horario) => horario.fk_grupo_animales));
    const grupoEnTicket = jugadas.length ? horariosPorId.get(jugadas[0].fk_horario_sorteo)?.fk_grupo_animales : undefined;
    if (gruposDestino.size > 1 || (grupoEnTicket !== undefined && !gruposDestino.has(grupoEnTicket))) {
      const lista = gruposPorId.get(destinos[0].fk_grupo_animales)?.nombre ?? '';
      establecerMensaje(t('repetir_lista_distinta', { lista }));
      return;
    }
    agregarJugadas(
      seleccionadas.map((jugada, indice) => ({
        fk_animal: jugada.fk_animal,
        fk_horario_sorteo: destinos[indice].pk_horario_sorteo,
        monto: Number(jugada.monto),
      })),
    );
    // El panel acompaña al ticket repetido: se dibuja la lista de los sorteos recién agregados.
    establecerPkGrupoActivo(destinos[0].fk_grupo_animales);
    cerrarRepetir();
    establecerNumeroRepetir('');
    establecerMensaje(t('jugadas_agregadas', { cantidad: seleccionadas.length }));
    window.requestAnimationFrame(() => referenciaAnimalManual.current?.focus());
  }

  async function consultarPago(evento: FormEvent) {
    evento.preventDefault();
    if (!/^\d{8}$/.test(serialPagar)) {
      establecerMensaje(t('serial_invalido'));
      return;
    }
    establecerConsultandoPago(true);
    try {
      establecerPagoConsultado(await llamarApi<PagoConsultado>(`/agencia/tickets/${serialPagar}/pago`, {}, token));
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerConsultandoPago(false);
    }
  }

  async function pagarTicket() {
    if (!pagoConsultado?.total_pagar) {
      establecerMensaje(t('sin_premios_consultados'));
      return;
    }
    establecerPagando(true);
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/agencia/tickets/${pagoConsultado.serial}/pagar`, { method: 'POST' }, token);
      establecerMensaje(respuesta.mensaje);
      establecerMostrarPagar(false);
      establecerPagoConsultado(null);
      establecerSerialPagar('');
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerPagando(false);
    }
  }

  async function emitir(evento: FormEvent) {
    evento.preventDefault();
    if (!jugadasVendibles.length) {
      establecerMensaje(jugadas.length ? t('sin_jugadas_con_cupo') : t('agrega_jugada_antes_emitir'));
      return;
    }
    establecerEmitiendo(true);
    establecerMensaje('');
    try {
      const ticket = await llamarApi<Ticket>('/agencia/tickets', { method: 'POST', body: JSON.stringify({ jugadas: jugadasVendibles }) }, token);
      establecerUltimoTicket(ticket);
      establecerJugadasUltimoTicket(jugadasVendibles);
      registrarCupos(ticket.cupos);
      establecerJugadas([]);
      reiniciarSeleccion();
      establecerMensaje(t('venta_exitosa'));
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerEmitiendo(false);
    }
  }

  if (cargando) return <p className="estado-pagina">{t('cargando')}</p>;
  if (sesionVencida)
    return (
      <section className="estado-sesion tarjeta" role="status">
        <h1>{t('sesion_vencida')}</h1>
        <p>{t('sesion_vencida_descripcion')}</p>
        <button type="button" className="boton-primario" onClick={alVencerSesion}>
          {t('salir')}
        </button>
      </section>
    );
  if (!inicio) return <p className="estado-pagina mensaje-error">{mensaje || t('error_consulta')}</p>;

  return (
    <section className="ventas">
      <div className="encabezado-ventas">
        <p className="etiqueta nombre-agencia">
          {inicio.agencia.nombre_agencia} · {inicio.agencia.codigo_agencia}
        </p>
        <time className="hora-venezuela">
          {t('hora_venezuela')}: {horaVenezuela}
        </time>
      </div>
      <form className="rejilla-ventas" onSubmit={emitir}>
        <section className="tarjeta panel-animales">
          <div className="titulo-panel">
            <span>{t('seleccionados', { cantidad: animalesSeleccionados.length })}</span>
          </div>
          <div className="rejilla-animales">
            {animalesOrdenados.map((animal) => (
              <button
                type="button"
                key={animal.pk_animal}
                aria-pressed={animalesSeleccionados.includes(animal.pk_animal)}
                className={`animal ${animalesSeleccionados.includes(animal.pk_animal) ? 'seleccionado' : ''}`}
                onClick={() => alternarAnimal(animal.pk_animal)}
              >
                <b>{formatearCodigoAnimal(animal.codigo_animal)}</b>
                <span>{animal.icono}</span>
                <small>{animal.nombre}</small>
              </button>
            ))}
          </div>
        </section>
        <section className="tarjeta panel-operacion">
          <div className="monto-agregar">
            <label className="animal-manual">
              {t('animal_manual')}
              <input
                ref={referenciaAnimalManual}
                aria-label={t('animal_manual')}
                type="text"
                maxLength={2}
                inputMode="numeric"
                autoComplete="off"
                placeholder="00"
                value={codigoAnimalManual}
                onKeyDown={manejarTeclaAnimal}
                onChange={(evento) => {
                  const valor = evento.target.value;
                  if (/^\d{0,2}$/.test(valor)) establecerCodigoAnimalManual(valor);
                }}
              />
            </label>
            <label>
              {t('monto')}
              <div className="campo-monto">
                <span>$</span>
                <input
                  ref={referenciaMonto}
                  aria-label={t('monto')}
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  value={monto}
                  onFocus={seleccionarMontoAlEnfocar}
                  onMouseUp={conservarSeleccionAlSoltar}
                  onKeyDown={manejarTecla}
                  onChange={(evento) => {
                    const valor = evento.target.value;
                    if (valor === '' || Number(valor) >= 1) establecerMonto(valor);
                  }}
                  onBlur={() => {
                    if (!monto || Number(monto) < 1) establecerMonto('1');
                  }}
                />
              </div>
            </label>
            <button type="button" className="boton-secundario ancho-completo" onClick={agregarJugada}>
              {t('agregar')} ↵
            </button>
            <button type="button" className="boton-secundario ancho-completo" onClick={() => void imprimirTicket()} disabled={verificando}>
              {verificando ? t('consultando') : t('imprimir')}
            </button>
          </div>
          <div className="titulo-panel">
            <h2>2. {t('sorteos')}</h2>
            <span>{t('seleccionados', { cantidad: horariosSeleccionados.length })}</span>
          </div>
          <div className="filtros-sorteos" role="group" aria-label={t('filtrar_sorteos')}>
            <button type="button" className={filtroSorteo === 'todos' ? 'activo' : ''} aria-pressed={filtroSorteo === 'todos'} onClick={() => filtrarSorteo('todos')}>
              {t('todos')}
            </button>
            {tiposSorteo.map((sorteo) => (
              <button
                type="button"
                key={sorteo}
                className={filtroSorteo === sorteo ? 'activo' : ''}
                aria-pressed={filtroSorteo === sorteo}
                onClick={() => filtrarSorteo(sorteo)}
              >
                {sorteo}
              </button>
            ))}
          </div>
          <div className="lista-sorteos">
            {horariosVisibles.length ? (
              horariosVisibles.map((horario) => (
                <label className={`opcion-sorteo ${horariosSeleccionados.includes(horario.pk_horario_sorteo) ? 'seleccionado' : ''}`} key={horario.pk_horario_sorteo}>
                  <input
                    type="checkbox"
                    checked={horariosSeleccionados.includes(horario.pk_horario_sorteo)}
                    onChange={() => alternarHorario(horario)}
                  />
                  <span>
                    <b>{horario.sorteo}</b>
                    <small>{horario.hora}</small>
                  </span>
                </label>
              ))
            ) : (
              <p className="vacio">{t('sin_sorteos_disponibles')}</p>
            )}
          </div>
        </section>
        <aside className="tarjeta panel-ticket">
          <div className="lista-jugadas">
            {jugadas.length === 0 ? (
              <p className="vacio">{t('no_hay_jugadas')}</p>
            ) : (
              jugadasOrdenadas.map((jugada) => {
                const animal = animalesPorId.get(jugada.fk_animal);
                const horario = horariosPorId.get(jugada.fk_horario_sorteo);
                const monto = montoVendible(jugada);
                return (
                  <div className="fila-jugada" key={claveCupo(jugada.fk_animal, jugada.fk_horario_sorteo)}>
                    <span className="detalle-jugada">
                      <span>
                        {animal?.icono} <b>{animal ? formatearCodigoAnimal(animal.codigo_animal) : ''}</b>
                      </span>
                      <span>{animal?.nombre}</span>
                      <small>
                        {horario?.sorteo} {horario?.hora}
                      </small>
                    </span>
                    <strong className={monto ? '' : 'monto-sin-cupo'} title={monto ? undefined : t('sin_cupo')}>
                      ${monto.toFixed(2)}
                    </strong>
                    <button
                      type="button"
                      aria-label={t('limpiar')}
                      onClick={() =>
                        establecerJugadas((actuales) =>
                          actuales.filter((item) => item.fk_animal !== jugada.fk_animal || item.fk_horario_sorteo !== jugada.fk_horario_sorteo),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>
          <div className="total total-superior">
            <span>{t('total_ticket')}</span>
            <strong>${total.toFixed(2)}</strong>
          </div>
          {jugadasSinCupo > 0 && <p className="nota-cupo">{t('jugadas_sin_cupo', { cantidad: jugadasSinCupo })}</p>}
          {validandoCupo && !jugadasSinCupo && <p className="nota-cupo">{t('validando_cupo')}</p>}
          <button className="boton-primario ancho-completo" disabled={emitiendo || !jugadasVendibles.length}>
            {emitiendo ? t('consultando') : t('emitir')}
          </button>
        </aside>
      </form>
      <section className="acciones-ticket tarjeta" aria-label={t('acciones_ticket')}>
        <button type="button" onClick={() => (jugadas.length ? establecerConfirmarLimpieza(true) : establecerMensaje(t('sin_jugadas_limpiar')))}>
          {t('limpiar_jugadas')}
        </button>
        <button type="button" onClick={abrirRepetir}>
          {t('repetir_ticket')}
        </button>
        <button type="button" onClick={() => establecerMostrarAnular(true)}>
          {t('anular_ticket')}
        </button>
        <button type="button" onClick={() => establecerMostrarPagar(true)}>
          {t('pagar_ticket')}
        </button>
      </section>
      {createPortal(
        <section className="ticket-pos" aria-hidden="true">
          <pre>{ticketImpresion}</pre>
        </section>,
        document.body,
      )}
      {mensaje && (
        <div className="notificacion emergente" role="status">
          {mensaje}
        </div>
      )}
      {confirmarLimpieza && (
        <div className="fondo-consulta">
          <section className="ventana-consulta tarjeta confirmacion-accion" role="dialog" aria-modal="true" aria-label={t('confirmar_limpieza')}>
            <header className="encabezado-consulta">
              <h2>{t('confirmar_limpieza')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerConfirmarLimpieza(false)}>
                ×
              </button>
            </header>
            <p>{t('limpieza_descripcion')}</p>
            <div className="acciones-modal">
              <button type="button" className="boton-secundario" onClick={() => establecerConfirmarLimpieza(false)}>
                {t('cancelar')}
              </button>
              <button
                type="button"
                className="boton-primario"
                onClick={() => {
                  limpiarJugadas();
                  establecerConfirmarLimpieza(false);
                }}
              >
                {t('si_limpiar')}
              </button>
            </div>
          </section>
        </div>
      )}
      {mostrarAnular && (
        <div className="fondo-consulta">
          <form className="ventana-consulta tarjeta formulario-anular" onSubmit={anularTicket}>
            <header className="encabezado-consulta">
              <h2>{t('anular_ticket')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerMostrarAnular(false)}>
                ×
              </button>
            </header>
            <p>{t('anular_descripcion')}</p>
            <label>
              {t('serial_ticket')}
              <input
                value={serialAnular}
                inputMode="numeric"
                maxLength={8}
                autoFocus
                onChange={(evento) => establecerSerialAnular(evento.target.value.replace(/\D/g, ''))}
                placeholder="12345678"
              />
            </label>
            <button className="boton-primario" disabled={anulando}>
              {anulando ? t('consultando') : t('anular_ticket')}
            </button>
          </form>
        </div>
      )}
      {mostrarRepetir && (
        <div className="fondo-consulta">
          <section className="ventana-consulta tarjeta modal-repetir" role="dialog" aria-modal="true" aria-label={t('repetir_ticket')}>
            <header className="encabezado-consulta">
              <h2>{t('repetir_ticket')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={cerrarRepetir}>
                ×
              </button>
            </header>
            <form className="formulario-busqueda-ticket" onSubmit={buscarTicketRepetir}>
              <label>
                {t('fecha')}
                <input type="date" value={fechaRepetir} onChange={(evento) => establecerFechaRepetir(evento.target.value)} required />
              </label>
              <label>
                {t('numero_ticket')}
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={numeroRepetir}
                  onChange={(evento) => establecerNumeroRepetir(evento.target.value)}
                  placeholder="Ej. 25"
                  required
                />
              </label>
              <button className="boton-buscar" disabled={buscandoRepetir}>
                {buscandoRepetir ? t('buscando') : t('buscar')}
              </button>
            </form>
            {ticketRepetir && (
              <div className="resultado-repetir">
                <div className="datos-ticket-repetir">
                  <span>Ticket #{ticketRepetir.numero_ticket}</span>
                  <span>Serial {ticketRepetir.serial}</span>
                  <strong>${Number(ticketRepetir.total_jugado).toFixed(2)}</strong>
                </div>
                <p>{t('repetir_descripcion')}</p>
                <div className="selecciones-repetir">
                  {[...ticketRepetir.jugadas]
                    .sort((primera, segunda) => (primera.horario_sorteo?.hora ?? '').localeCompare(segunda.horario_sorteo?.hora ?? ''))
                    .map((jugada) => {
                      const destino = horariosDisponibles.find((horario) => horario.sorteo === jugada.horario_sorteo?.sorteo?.nombre);
                      return (
                        <label className={`seleccion-jugada ${destino ? '' : 'no-disponible'}`} key={jugada.pk_jugada_ticket}>
                          <input
                            type="checkbox"
                            checked={jugadasRepetir.includes(jugada.pk_jugada_ticket)}
                            disabled={!destino}
                            onChange={() =>
                              establecerJugadasRepetir((actuales) =>
                                actuales.includes(jugada.pk_jugada_ticket)
                                  ? actuales.filter((id) => id !== jugada.pk_jugada_ticket)
                                  : [...actuales, jugada.pk_jugada_ticket],
                              )
                            }
                          />
                          <span>
                            <b>
                              {jugada.horario_sorteo?.sorteo?.nombre} · {destino ? destino.hora : t('sin_proximo_horario')}
                            </b>
                            <small>
                              {formatearCodigoAnimal(jugada.animal?.codigo_animal ?? '')} · {jugada.animal?.nombre}
                              {destino && destino.hora !== jugada.horario_sorteo?.hora ? ` · ${t('antes')} ${jugada.horario_sorteo?.hora}` : ''}
                            </small>
                          </span>
                          <strong>${Number(jugada.monto).toFixed(2)}</strong>
                        </label>
                      );
                    })}
                </div>
                <div className="acciones-modal">
                  <button type="button" className="boton-secundario" onClick={cerrarRepetir}>
                    {t('cancelar')}
                  </button>
                  <button type="button" className="boton-primario" disabled={!jugadasRepetir.length} onClick={usarTicketRepetido}>
                    {t('utilizar_ticket')}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
      {mostrarPagar && (
        <div className="fondo-consulta">
          <section className="ventana-consulta tarjeta modal-pagar" role="dialog" aria-modal="true" aria-label={t('pagar_ticket')}>
            <header className="encabezado-consulta">
              <h2>{t('pagar_ticket')}</h2>
              <button
                type="button"
                className="boton-cerrar"
                aria-label={t('cerrar')}
                onClick={() => {
                  establecerMostrarPagar(false);
                  establecerPagoConsultado(null);
                }}
              >
                ×
              </button>
            </header>
            {!pagoConsultado ? (
              <form className="formulario-busqueda-ticket formulario-pago" onSubmit={consultarPago}>
                <label>
                  {t('serial_ticket')}
                  <input
                    value={serialPagar}
                    inputMode="numeric"
                    maxLength={8}
                    autoFocus
                    onChange={(evento) => establecerSerialPagar(evento.target.value.replace(/\D/g, ''))}
                    placeholder="12345678"
                    required
                  />
                </label>
                <button className="boton-buscar" disabled={consultandoPago}>
                  {consultandoPago ? t('consultando') : t('buscar')}
                </button>
              </form>
            ) : (
              <div className="resultado-pago">
                <div className="datos-ticket-repetir">
                  <span>Ticket #{pagoConsultado.numero_ticket}</span>
                  <span>{pagoConsultado.fecha_juego}</span>
                  <strong>${pagoConsultado.total_pagar.toFixed(2)}</strong>
                </div>
                {pagoConsultado.total_pagar > 0 ? (
                  <>
                    <p>{t('premios_encontrados')}</p>
                    <div className="selecciones-repetir">
                      {[...pagoConsultado.jugadas_premiadas]
                        .sort((primera, segunda) => (primera.horario_sorteo?.hora ?? '').localeCompare(segunda.horario_sorteo?.hora ?? ''))
                        .map((jugada) => (
                          <div className="seleccion-jugada premio" key={jugada.pk_jugada_ticket}>
                            <span>
                              <b>
                                {jugada.horario_sorteo?.hora} · {jugada.horario_sorteo?.sorteo?.nombre}
                              </b>
                              <small>
                                {formatearCodigoAnimal(jugada.animal?.codigo_animal ?? '')} · {jugada.animal?.nombre} · x{jugada.multiplicador_premio}
                              </small>
                            </span>
                            <strong>${Number(jugada.premio ?? 0).toFixed(2)}</strong>
                          </div>
                        ))}
                    </div>
                    <div className="acciones-modal">
                      <button
                        type="button"
                        className="boton-secundario"
                        onClick={() => {
                          establecerMostrarPagar(false);
                          establecerPagoConsultado(null);
                        }}
                      >
                        {t('cancelar')}
                      </button>
                      <button type="button" className="boton-primario" disabled={pagando} onClick={pagarTicket}>
                        {pagando ? t('pagando') : t('pagar_monto', { monto: pagoConsultado.total_pagar.toFixed(2) })}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="sin-premio">{t('sin_premios')}</p>
                    <div className="acciones-modal">
                      <button
                        type="button"
                        className="boton-secundario"
                        onClick={() => {
                          establecerMostrarPagar(false);
                          establecerPagoConsultado(null);
                        }}
                      >
                        {t('cerrar')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
      {vistaPreviaTicket && (
        <div className="fondo-consulta">
          <section className="vista-ticket tarjeta" role="dialog" aria-modal="true" aria-label={t('vista_previa')}>
            <header className="encabezado-consulta">
              <h2>{t('vista_previa')}</h2>
              <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={() => establecerVistaPreviaTicket('')}>
                ×
              </button>
            </header>
            <pre>{vistaPreviaTicket}</pre>
            <button type="button" className="boton-primario" onClick={() => establecerVistaPreviaTicket('')}>
              {t('listo')}
            </button>
          </section>
        </div>
      )}
    </section>
  );
}
