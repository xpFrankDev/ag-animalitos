import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, randomUUID } from 'crypto';
import { Between, DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import {
  Agencia,
  Animal,
  EstadoJugada,
  EstadoTicket,
  Grupero,
  HorarioSorteo,
  JugadaTicket,
  Resultado,
  Ticket,
  TipoUsuario,
} from '../base-datos/entidades';
import { aDecimal, calcularComision, multiplicarMonto, sumarMontos } from '../comun/dinero';
import { cierreDeHorario, fechaOperacion, numeroTicketDelDia, resolverFecha, zonaHorariaOperacion } from '../comun/fechas';
import { CupoService, EvaluacionCupo } from './cupo.service';
import { CrearVentaDto, JugadaNuevaDto, ValidarVentaDto } from './dto/crear-venta.dto';

type Sesion = { sub: string; tipo_usuario: TipoUsuario };
type FiltrosTickets = { estado?: string; desde?: string; hasta?: string; pagina?: number; tamano?: number };
type PremioDetalle = { pk_jugada_ticket: string; monto: number; multiplicador: number; premio: number };

const TAMANO_PAGINA_POR_DEFECTO = 25;
const TAMANO_PAGINA_MAXIMO = 100;

@Injectable()
export class AgenciaService {
  constructor(
    private readonly origenDatos: DataSource,
    private readonly cupo: CupoService,
    @InjectRepository(Agencia) private readonly repositorioAgencias: Repository<Agencia>,
    @InjectRepository(Animal) private readonly repositorioAnimales: Repository<Animal>,
    @InjectRepository(HorarioSorteo) private readonly repositorioHorarios: Repository<HorarioSorteo>,
    @InjectRepository(Ticket) private readonly repositorioTickets: Repository<Ticket>,
  ) {}

  private async obtenerAgencia(sesion: Sesion): Promise<Agencia> {
    if (sesion.tipo_usuario !== TipoUsuario.AGENCIA) throw new ForbiddenException('Este módulo es exclusivo para Agencias.');
    const agencia = await this.repositorioAgencias.findOne({ where: { fk_usuario: sesion.sub, activa: true } });
    if (!agencia) throw new ForbiddenException('El usuario no tiene una Agencia activa asignada.');
    return agencia;
  }

  private horarioCerrado(horario: HorarioSorteo, minutosCierre: number, fechaJuego: string): boolean {
    return new Date() >= cierreDeHorario(fechaJuego, horario.hora, minutosCierre);
  }

  private validarCierre(horario: HorarioSorteo, minutosCierre: number, fechaJuego: string): void {
    if (this.horarioCerrado(horario, minutosCierre, fechaJuego)) {
      throw new BadRequestException(`El sorteo ${horario.sorteo.nombre} ${horario.hora.slice(0, 5)} ya está cerrado.`);
    }
  }

  private validarJugadas(
    jugadas: JugadaNuevaDto[],
    animales: Animal[],
    horarios: HorarioSorteo[],
    agencia: Agencia,
    fechaJuego: string,
  ): void {
    const animalesValidos = new Set(animales.map((animal) => animal.pk_animal));
    const horariosPorId = new Map(horarios.map((horario) => [horario.pk_horario_sorteo, horario]));
    for (const jugada of jugadas) {
      if (!animalesValidos.has(jugada.fk_animal)) throw new BadRequestException('Uno de los animales ya no está disponible.');
      const horario = horariosPorId.get(jugada.fk_horario_sorteo);
      if (!horario) throw new BadRequestException('Uno de los sorteos ya no está disponible.');
      if (jugada.monto < Number(agencia.jugada_minima)) throw new BadRequestException(`La jugada mínima es ${agencia.jugada_minima}.`);
      this.validarCierre(horario, agencia.minutos_cierre, fechaJuego);
    }
  }

  private async validarCatalogo(jugadas: JugadaNuevaDto[], agencia: Agencia, fechaJuego: string): Promise<void> {
    const [animales, horarios] = await Promise.all([
      this.repositorioAnimales.find({ where: { pk_animal: In(jugadas.map((jugada) => jugada.fk_animal)), activo: true } }),
      this.repositorioHorarios.find({
        where: { pk_horario_sorteo: In(jugadas.map((jugada) => jugada.fk_horario_sorteo)), activo: true },
        relations: { sorteo: true },
      }),
    ]);
    this.validarJugadas(jugadas, animales, horarios, agencia, fechaJuego);
  }

  private async datosGrupo(fkGrupero: string | null): Promise<{ cupo: number; idsAgencias: string[] } | null> {
    if (!fkGrupero) return null;
    const grupero = await this.origenDatos.getRepository(Grupero).findOneBy({ pk_grupero: fkGrupero });
    if (!grupero) return null;
    const agencias = await this.repositorioAgencias.find({ where: { fk_grupero: fkGrupero }, select: { pk_agencia: true } });
    return { cupo: Number(grupero.cupo_animal), idsAgencias: agencias.map((agencia) => agencia.pk_agencia) };
  }

  async obtenerInicio(sesion: Sesion) {
    const agencia = await this.obtenerAgencia(sesion);
    const fechaJuego = fechaOperacion();
    const [animales, horarios] = await Promise.all([
      this.repositorioAnimales.find({ where: { activo: true }, order: { codigo_animal: 'ASC' } }),
      this.repositorioHorarios.find({
        where: { activo: true },
        relations: { sorteo: true },
        order: { fk_sorteo: 'ASC', hora: 'ASC' },
      }),
    ]);
    return {
      fecha_juego: fechaJuego,
      zona_horaria: zonaHorariaOperacion(),
      agencia: {
        nombre_agencia: agencia.nombre_agencia,
        codigo_agencia: agencia.codigo_agencia,
        cupo_animal: Number(agencia.cupo_animal),
        jugada_minima: Number(agencia.jugada_minima),
        minutos_cierre: agencia.minutos_cierre,
        comision_porcentaje: Number(agencia.comision_porcentaje),
      },
      animales,
      horarios: horarios.map((horario) => ({
        pk_horario_sorteo: horario.pk_horario_sorteo,
        hora: horario.hora.slice(0, 5),
        sorteo: horario.sorteo.nombre,
        multiplicador_premio: Number(horario.sorteo.multiplicador_premio),
        disponible: !this.horarioCerrado(horario, agencia.minutos_cierre, fechaJuego),
      })),
    };
  }

  /**
   * Comprobación previa a la impresión: exige que la base de datos esté accesible y
   * devuelve el cupo vigente de agencia y grupero para las jugadas del ticket.
   */
  async validarVenta(sesion: Sesion, datos: ValidarVentaDto) {
    const agencia = await this.obtenerAgencia(sesion);
    const fechaJuego = fechaOperacion();
    const verificado_at = new Date().toISOString();
    if (datos.serial) {
      const ticket = await this.repositorioTickets.findOne({ where: { serial: datos.serial, fk_agencia: agencia.pk_agencia } });
      if (!ticket) throw new NotFoundException('No se encontró ese ticket en esta agencia.');
      return { verificado_at, fecha_juego: fechaJuego, puede_emitir: true, detalle: [] as EvaluacionCupo[], mensaje: undefined };
    }
    if (!datos.jugadas?.length) throw new BadRequestException('Envía las jugadas del ticket o el serial de un ticket emitido.');
    const jugadas = this.acumularJugadas(datos.jugadas);
    await this.validarCatalogo(jugadas, agencia, fechaJuego);
    const grupo = await this.datosGrupo(agencia.fk_grupero);
    const detalle = await this.cupo.evaluar(this.origenDatos.manager, { fechaJuego, jugadas, agencia, grupo });
    const excedida = detalle.find((item) => item.excedido);
    return {
      verificado_at,
      fecha_juego: fechaJuego,
      puede_emitir: !excedida,
      detalle,
      mensaje: excedida ? this.mensajeCupo(excedida) : undefined,
    };
  }

  private mensajeCupo(item: EvaluacionCupo): string {
    const disponible = item.excedido === 'AGENCIA' ? item.disponible_agencia : item.disponible_grupero;
    return `Cupo de ${item.excedido === 'AGENCIA' ? 'la agencia' : 'el grupero'} agotado para una de las combinaciones. Disponible: ${Number(disponible ?? 0).toFixed(2)}.`;
  }

  /** Bloquea primero el grupero y después la agencia, siempre en el mismo orden para evitar interbloqueos. */
  private async bloquearAlcance(gestor: EntityManager, agencia: Agencia) {
    let grupo: { cupo: number; idsAgencias: string[] } | null = null;
    if (agencia.fk_grupero) {
      const grupero = await gestor
        .getRepository(Grupero)
        .createQueryBuilder('grupero')
        .setLock('pessimistic_write')
        .where('grupero.pk_grupero = :pk_grupero', { pk_grupero: agencia.fk_grupero })
        .getOneOrFail();
      const agenciasGrupo = await gestor
        .getRepository(Agencia)
        .find({ where: { fk_grupero: grupero.pk_grupero }, select: { pk_agencia: true } });
      grupo = { cupo: Number(grupero.cupo_animal), idsAgencias: agenciasGrupo.map((item) => item.pk_agencia) };
    }
    const agenciaBloqueada = await gestor
      .getRepository(Agencia)
      .createQueryBuilder('agencia')
      .setLock('pessimistic_write')
      .where('agencia.pk_agencia = :pk_agencia', { pk_agencia: agencia.pk_agencia })
      .getOneOrFail();
    return { agenciaBloqueada, grupo };
  }

  async crearVenta(sesion: Sesion, datos: CrearVentaDto) {
    const agencia = await this.obtenerAgencia(sesion);
    const jugadas = this.acumularJugadas(datos.jugadas);
    const fechaJuego = fechaOperacion();
    await this.validarCatalogo(jugadas, agencia, fechaJuego);
    const totalJugado = sumarMontos(jugadas.map((jugada) => jugada.monto));

    return this.origenDatos.transaction(async (gestor) => {
      const { agenciaBloqueada, grupo } = await this.bloquearAlcance(gestor, agencia);
      const evaluacion = await this.cupo.validar(gestor, { fechaJuego, jugadas, agencia: agenciaBloqueada, grupo });
      const numeroTicket = numeroTicketDelDia(
        agenciaBloqueada.fecha_numero_ticket,
        agenciaBloqueada.proximo_numero_ticket,
        fechaJuego,
      );
      const serial = await this.generarSerialTicket(gestor);
      const ticket = gestor.getRepository(Ticket).create({
        pk_ticket: randomUUID(),
        serial,
        numero_ticket: numeroTicket,
        fecha_juego: fechaJuego,
        fk_agencia: agenciaBloqueada.pk_agencia,
        estado: EstadoTicket.ACTIVO,
        total_jugado: aDecimal(totalJugado),
        total_premio: '0.00',
        monto_pagado: '0.00',
        fk_usuario_modificado: sesion.sub,
      });
      await gestor.save(ticket);
      await gestor.getRepository(Agencia).update(agenciaBloqueada.pk_agencia, {
        proximo_numero_ticket: numeroTicket + 1,
        fecha_numero_ticket: fechaJuego,
        fk_usuario_modificado: sesion.sub,
      });
      await gestor.save(
        jugadas.map((jugada) =>
          gestor.getRepository(JugadaTicket).create({
            pk_jugada_ticket: randomUUID(),
            fk_ticket: ticket.pk_ticket,
            fk_animal: jugada.fk_animal,
            fk_horario_sorteo: jugada.fk_horario_sorteo,
            fecha_juego: fechaJuego,
            monto: aDecimal(jugada.monto),
            estado: EstadoJugada.ACTIVA,
            fk_usuario_modificado: sesion.sub,
          }),
        ),
      );
      return {
        serial: ticket.serial,
        numero_ticket: ticket.numero_ticket,
        fecha_juego: fechaJuego,
        total_jugado: totalJugado,
        creado_at: ticket.creado_at,
        cupos: evaluacion,
      };
    });
  }

  private acumularJugadas(jugadas: JugadaNuevaDto[]): JugadaNuevaDto[] {
    const acumuladas = new Map<string, JugadaNuevaDto>();
    for (const jugada of jugadas) {
      const clave = `${jugada.fk_animal}-${jugada.fk_horario_sorteo}`;
      const anterior = acumuladas.get(clave);
      acumuladas.set(
        clave,
        anterior ? { ...anterior, monto: Math.round((anterior.monto + jugada.monto) * 100) / 100 } : { ...jugada },
      );
    }
    return [...acumuladas.values()];
  }

  private async generarSerialTicket(gestor: EntityManager): Promise<string> {
    for (let intento = 0; intento < 10; intento += 1) {
      const serial = String(randomInt(10_000_000, 100_000_000));
      if (!(await gestor.getRepository(Ticket).existsBy({ serial }))) return serial;
    }
    throw new BadRequestException('No fue posible generar un serial único para el ticket. Inténtalo de nuevo.');
  }

  async listarResultados(sesion: Sesion, fecha?: string) {
    await this.obtenerAgencia(sesion);
    const fechaConsulta = resolverFecha(fecha);
    return this.origenDatos
      .getRepository(Resultado)
      .createQueryBuilder('resultado')
      .innerJoin(HorarioSorteo, 'horario', 'horario.pk_horario_sorteo = resultado.fk_horario_sorteo')
      .innerJoin('horario.sorteo', 'sorteo')
      .innerJoin(Animal, 'animal', 'animal.pk_animal = resultado.fk_animal')
      .select([
        'resultado.pk_resultado AS pk_resultado',
        'resultado.origen AS origen',
        'horario.hora AS hora',
        'sorteo.nombre AS sorteo',
        'animal.codigo_animal AS codigo_animal',
        'animal.nombre AS nombre_animal',
        'animal.icono AS icono_animal',
      ])
      .where('resultado.fecha_juego = :fecha', { fecha: fechaConsulta })
      .orderBy('horario.hora', 'ASC')
      .getRawMany();
  }

  async listarTickets(sesion: Sesion, filtros: FiltrosTickets = {}) {
    const agencia = await this.obtenerAgencia(sesion);
    if (filtros.estado && !Object.values(EstadoTicket).includes(filtros.estado as EstadoTicket)) {
      throw new BadRequestException('El estado de ticket no es válido.');
    }
    const fechaDesde = resolverFecha(filtros.desde);
    const fechaHasta = resolverFecha(filtros.hasta ?? filtros.desde);
    if (fechaDesde > fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const tamano = Math.min(TAMANO_PAGINA_MAXIMO, Math.max(1, Number(filtros.tamano) || TAMANO_PAGINA_POR_DEFECTO));
    const [items, total] = await this.repositorioTickets.findAndCount({
      where: {
        fk_agencia: agencia.pk_agencia,
        fecha_juego: Between(fechaDesde, fechaHasta),
        ...(filtros.estado ? { estado: filtros.estado as EstadoTicket } : {}),
      },
      relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } },
      order: { creado_at: 'DESC' },
      skip: (pagina - 1) * tamano,
      take: tamano,
    });
    return { items, total, pagina, tamano, tiene_mas: pagina * tamano < total };
  }

  async buscarTicket(sesion: Sesion, fecha?: string, numero?: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const fechaJuego = resolverFecha(fecha);
    const numeroTicket = Number(numero);
    if (!Number.isInteger(numeroTicket) || numeroTicket < 1) throw new BadRequestException('Ingresa un número de ticket válido.');
    const ticket = await this.repositorioTickets.findOne({
      where: { fk_agencia: agencia.pk_agencia, fecha_juego: fechaJuego, numero_ticket: numeroTicket },
      relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } },
    });
    if (!ticket) throw new NotFoundException('No se encontró ese ticket para la fecha indicada.');
    return ticket;
  }

  /** Los premios se calculan con el multiplicador del sorteo de cada jugada ganadora. */
  private async premioTicket(
    ticket: Ticket,
    resultados: Repository<Resultado>,
  ): Promise<{ total_premio: number; detalle: PremioDetalle[] }> {
    const resultadosDelDia = await resultados.find({ where: { fecha_juego: ticket.fecha_juego } });
    const ganadoresPorHorario = new Map(
      resultadosDelDia.map((resultado) => [resultado.fk_horario_sorteo, resultado.fk_animal]),
    );
    const detalle: PremioDetalle[] = ticket.jugadas
      .filter(
        (jugada) =>
          jugada.estado !== EstadoJugada.CANCELADA && ganadoresPorHorario.get(jugada.fk_horario_sorteo) === jugada.fk_animal,
      )
      .map((jugada) => {
        const multiplicador = Number(jugada.horario_sorteo?.sorteo?.multiplicador_premio ?? 30);
        return {
          pk_jugada_ticket: jugada.pk_jugada_ticket,
          monto: Number(jugada.monto),
          multiplicador,
          premio: multiplicarMonto(Number(jugada.monto), multiplicador),
        };
      });
    return { total_premio: sumarMontos(detalle.map((item) => item.premio)), detalle };
  }

  async consultarPago(sesion: Sesion, serial: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const ticket = await this.repositorioTickets.findOne({
      where: { serial, fk_agencia: agencia.pk_agencia },
      relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado.');
    if (ticket.estado === EstadoTicket.PAGADO) throw new BadRequestException('Este ticket ya fue pagado.');
    if (ticket.estado === EstadoTicket.CANCELADO) throw new BadRequestException('Un ticket anulado no puede pagarse.');
    const premio = await this.premioTicket(ticket, this.origenDatos.getRepository(Resultado));
    return {
      serial: ticket.serial,
      numero_ticket: ticket.numero_ticket,
      fecha_juego: ticket.fecha_juego,
      estado: ticket.estado,
      total_pagar: premio.total_premio,
      jugadas_premiadas: ticket.jugadas
        .filter((jugada) => premio.detalle.some((item) => item.pk_jugada_ticket === jugada.pk_jugada_ticket))
        .map((jugada) => {
          const detalle = premio.detalle.find((item) => item.pk_jugada_ticket === jugada.pk_jugada_ticket)!;
          return { ...jugada, multiplicador_premio: detalle.multiplicador, premio: detalle.premio };
        }),
    };
  }

  async pagarTicket(sesion: Sesion, serial: string) {
    const agencia = await this.obtenerAgencia(sesion);
    return this.origenDatos.transaction(async (gestor) => {
      const ticket = await gestor
        .getRepository(Ticket)
        .createQueryBuilder('ticket')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('ticket.jugadas', 'jugadas')
        .leftJoinAndSelect('jugadas.horario_sorteo', 'horario_sorteo')
        .leftJoinAndSelect('horario_sorteo.sorteo', 'sorteo')
        .where('ticket.serial = :serial AND ticket.fk_agencia = :agencia', { serial, agencia: agencia.pk_agencia })
        .getOne();
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      if (ticket.estado === EstadoTicket.PAGADO) throw new BadRequestException('Este ticket ya fue pagado.');
      if (ticket.estado === EstadoTicket.CANCELADO) throw new BadRequestException('Un ticket anulado no puede pagarse.');
      const premio = await this.premioTicket(ticket, gestor.getRepository(Resultado));
      if (!premio.total_premio) throw new BadRequestException('Este ticket no tiene jugadas premiadas para pagar.');
      await gestor.getRepository(Ticket).update(ticket.pk_ticket, {
        estado: EstadoTicket.PAGADO,
        total_premio: aDecimal(premio.total_premio),
        monto_pagado: aDecimal(premio.total_premio),
        fk_usuario_modificado: sesion.sub,
      });
      await gestor.getRepository(JugadaTicket).update(
        { pk_jugada_ticket: In(premio.detalle.map((item) => item.pk_jugada_ticket)) },
        { estado: EstadoJugada.PAGADA, fk_usuario_modificado: sesion.sub },
      );
      return {
        mensaje: `Ticket pagado correctamente: ${premio.total_premio.toFixed(2)}.`,
        total_pagado: premio.total_premio,
      };
    });
  }

  async resumenVentas(sesion: Sesion, desde?: string, hasta?: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const fechaDesde = resolverFecha(desde);
    const fechaHasta = resolverFecha(hasta ?? desde);
    if (fechaDesde > fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    const [tickets, total_tickets] = await this.repositorioTickets.findAndCount({
      where: {
        fk_agencia: agencia.pk_agencia,
        fecha_juego: Between(fechaDesde, fechaHasta),
        estado: Not(EstadoTicket.CANCELADO),
      },
      relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } },
      order: { creado_at: 'DESC' },
      take: TAMANO_PAGINA_MAXIMO,
    });
    const total_vendido = sumarMontos(tickets.map((ticket) => ticket.total_jugado));
    const total_premiado = sumarMontos(tickets.map((ticket) => ticket.total_premio));
    const porcentaje_comision = Number(agencia.comision_porcentaje);
    const total_comision = calcularComision(total_vendido, porcentaje_comision);
    return {
      desde: fechaDesde,
      hasta: fechaHasta,
      total_vendido,
      total_premiado,
      porcentaje_comision,
      total_comision,
      resto: sumarMontos([total_vendido, -total_premiado]),
      total_tickets,
      tickets,
    };
  }

  async cancelarTicket(sesion: Sesion, serial: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const ticket = await this.repositorioTickets.findOne({
      where: { serial, fk_agencia: agencia.pk_agencia },
      relations: { jugadas: true },
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado.');
    if (ticket.estado !== EstadoTicket.ACTIVO) throw new BadRequestException('Solo se pueden cancelar tickets activos.');
    if (Date.now() - ticket.creado_at.getTime() > agencia.minutos_cierre * 60_000) {
      throw new BadRequestException('El tiempo para cancelar este ticket ya venció.');
    }
    await this.origenDatos.transaction(async (gestor) => {
      await gestor.getRepository(Ticket).update(ticket.pk_ticket, {
        estado: EstadoTicket.CANCELADO,
        fk_usuario_modificado: sesion.sub,
      });
      await gestor
        .getRepository(JugadaTicket)
        .update({ fk_ticket: ticket.pk_ticket }, { estado: EstadoJugada.CANCELADA, fk_usuario_modificado: sesion.sub });
    });
    return { mensaje: 'Ticket cancelado correctamente.' };
  }
}
