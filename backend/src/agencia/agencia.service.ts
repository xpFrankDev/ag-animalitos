import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, randomUUID } from 'crypto';
import { Between, DataSource, In, Not, Repository } from 'typeorm';
import { EstadoJugada, EstadoTicket, Agencia, Animal, Grupero, HorarioSorteo, JugadaTicket, Resultado, Ticket, TipoUsuario } from '../base-datos/entidades';
import { CrearVentaDto, JugadaNuevaDto } from './dto/crear-venta.dto';

type Sesion = { sub: string; tipo_usuario: TipoUsuario };

@Injectable()
export class AgenciaService {
  constructor(
    private readonly origenDatos: DataSource,
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

  async obtenerInicio(sesion: Sesion) {
    const agencia = await this.obtenerAgencia(sesion);
    const animales = await this.repositorioAnimales.find({ where: { activo: true }, order: { codigo_animal: 'ASC' } });
    const horarios = await this.repositorioHorarios.find({ where: { activo: true }, relations: { sorteo: true }, order: { fk_sorteo: 'ASC', hora: 'ASC' } });
    return {
      agencia: { nombre_agencia: agencia.nombre_agencia, codigo_agencia: agencia.codigo_agencia, cupo_animal: Number(agencia.cupo_animal), jugada_minima: Number(agencia.jugada_minima), minutos_cierre: agencia.minutos_cierre, comision_porcentaje: Number(agencia.comision_porcentaje) },
      animales,
      horarios: horarios.map((horario) => ({ pk_horario_sorteo: horario.pk_horario_sorteo, hora: horario.hora.slice(0, 5), sorteo: horario.sorteo.nombre, disponible: this.horarioDisponible(horario, agencia.minutos_cierre) })),
      multiplicador_premio: 30,
    };
  }

  private validarCierre(horario: HorarioSorteo, minutosCierre: number): void {
    const fecha = new Date();
    const [hora, minuto] = horario.hora.split(':').map(Number);
    fecha.setHours(hora, minuto - minutosCierre, 0, 0);
    if (new Date() >= fecha) throw new BadRequestException(`El sorteo ${horario.sorteo.nombre} ${horario.hora.slice(0, 5)} ya está cerrado.`);
  }

  private horarioDisponible(horario: HorarioSorteo, minutosCierre: number): boolean {
    try { this.validarCierre(horario, minutosCierre); return true; } catch { return false; }
  }

  private validarJugadas(jugadas: JugadaNuevaDto[], animales: Animal[], horarios: HorarioSorteo[], agencia: Agencia): void {
    const animalesValidos = new Set(animales.map((animal) => animal.pk_animal));
    const horariosPorId = new Map(horarios.map((horario) => [horario.pk_horario_sorteo, horario]));
    for (const jugada of jugadas) {
      if (!animalesValidos.has(jugada.fk_animal)) throw new BadRequestException('Uno de los animales ya no está disponible.');
      const horario = horariosPorId.get(jugada.fk_horario_sorteo);
      if (!horario) throw new BadRequestException('Uno de los sorteos ya no está disponible.');
      if (jugada.monto < Number(agencia.jugada_minima)) throw new BadRequestException(`La jugada mínima es ${agencia.jugada_minima}.`);
      this.validarCierre(horario, agencia.minutos_cierre);
    }
  }

  async crearVenta(sesion: Sesion, datos: CrearVentaDto) {
    const agencia = await this.obtenerAgencia(sesion);
    const jugadas = this.acumularJugadas(datos.jugadas);
    const [animales, horarios] = await Promise.all([
      this.repositorioAnimales.find({ where: { pk_animal: In(jugadas.map((jugada) => jugada.fk_animal)), activo: true } }),
      this.repositorioHorarios.find({ where: { pk_horario_sorteo: In(jugadas.map((jugada) => jugada.fk_horario_sorteo)), activo: true }, relations: { sorteo: true } }),
    ]);
    this.validarJugadas(jugadas, animales, horarios, agencia);
    const fechaJuego = new Date().toISOString().slice(0, 10);

    return this.origenDatos.transaction(async (gestor) => {
      // Bloquear la Agencia evita números de ticket duplicados y ventas concurrentes locales.
      const agenciaBloqueada = await gestor.getRepository(Agencia).createQueryBuilder('agencia').setLock('pessimistic_write').where('agencia.pk_agencia = :pk_agencia', { pk_agencia: agencia.pk_agencia }).getOneOrFail();
      const agenciasDelGrupo = agenciaBloqueada.fk_grupero
        ? await gestor.getRepository(Agencia).createQueryBuilder('agencia').setLock('pessimistic_write').where('agencia.fk_grupero = :fk_grupero', { fk_grupero: agenciaBloqueada.fk_grupero }).getMany()
        : [agenciaBloqueada];
      const idsAgenciasGrupo = agenciasDelGrupo.map((item) => item.pk_agencia);

      for (const jugada of jugadas) {
        await this.validarCupo(gestor, jugada, fechaJuego, [agenciaBloqueada.pk_agencia], Number(agenciaBloqueada.cupo_animal), 'Agencia');
        if (agenciaBloqueada.fk_grupero) {
          const grupero = await gestor.getRepository(Grupero).createQueryBuilder('grupero').setLock('pessimistic_write').where('grupero.pk_grupero = :pk_grupero', { pk_grupero: agenciaBloqueada.fk_grupero }).getOneOrFail();
          await this.validarCupo(gestor, jugada, fechaJuego, idsAgenciasGrupo, Number(grupero.cupo_animal), 'Grupero');
        }
      }

      const totalJugado = jugadas.reduce((total, jugada) => total + Math.round(jugada.monto * 100), 0) / 100;
      const serial = await this.generarSerialTicket(gestor);
      const ticket = gestor.getRepository(Ticket).create({
        pk_ticket: randomUUID(),
        serial,
        numero_ticket: agenciaBloqueada.proximo_numero_ticket,
        fecha_juego: fechaJuego,
        fk_agencia: agenciaBloqueada.pk_agencia,
        estado: EstadoTicket.ACTIVO,
        total_jugado: totalJugado.toFixed(2),
        total_premio: '0.00',
        monto_pagado: '0.00',
        fk_usuario_modificado: sesion.sub,
      });
      await gestor.save(ticket);
      await gestor.getRepository(Agencia).update(agenciaBloqueada.pk_agencia, { proximo_numero_ticket: agenciaBloqueada.proximo_numero_ticket + 1, fk_usuario_modificado: sesion.sub });
      await gestor.save(jugadas.map((jugada) => gestor.getRepository(JugadaTicket).create({
        pk_jugada_ticket: randomUUID(), fk_ticket: ticket.pk_ticket, fk_animal: jugada.fk_animal, fk_horario_sorteo: jugada.fk_horario_sorteo, fecha_juego: fechaJuego, monto: jugada.monto.toFixed(2), estado: EstadoJugada.ACTIVA, fk_usuario_modificado: sesion.sub,
      })));
      return { serial: ticket.serial, numero_ticket: ticket.numero_ticket, total_jugado: totalJugado, creado_at: ticket.creado_at };
    });
  }

  private acumularJugadas(jugadas: JugadaNuevaDto[]): JugadaNuevaDto[] {
    const acumuladas = new Map<string, JugadaNuevaDto>();
    for (const jugada of jugadas) {
      const clave = `${jugada.fk_animal}-${jugada.fk_horario_sorteo}`;
      const anterior = acumuladas.get(clave);
      acumuladas.set(clave, anterior ? { ...anterior, monto: Math.round((anterior.monto + jugada.monto) * 100) / 100 } : { ...jugada });
    }
    return [...acumuladas.values()];
  }

  private async generarSerialTicket(gestor: DataSource['manager']): Promise<string> {
    for (let intento = 0; intento < 10; intento += 1) {
      const serial = String(randomInt(10_000_000, 100_000_000));
      if (!(await gestor.getRepository(Ticket).existsBy({ serial }))) return serial;
    }
    throw new BadRequestException('No fue posible generar un serial único para el ticket. Inténtalo de nuevo.');
  }

  private async validarCupo(gestor: DataSource['manager'], jugada: JugadaNuevaDto, fechaJuego: string, idsAgencias: string[], cupo: number, etiqueta: string): Promise<void> {
    const resultado = await gestor.getRepository(JugadaTicket).createQueryBuilder('jugada')
      .innerJoin('jugada.ticket', 'ticket')
      .select('COALESCE(SUM(jugada.monto), 0)', 'total')
      .where('jugada.fecha_juego = :fechaJuego AND jugada.fk_animal = :animal AND jugada.fk_horario_sorteo = :horario', { fechaJuego, animal: jugada.fk_animal, horario: jugada.fk_horario_sorteo })
      .andWhere('jugada.estado IN (:...estados)', { estados: [EstadoJugada.ACTIVA, EstadoJugada.PREMIADA, EstadoJugada.PAGADA] })
      .andWhere('ticket.fk_agencia IN (:...idsAgencias)', { idsAgencias })
      .getRawOne<{ total: string }>();
    const vendido = Number(resultado?.total ?? 0);
    if (vendido + jugada.monto > cupo + 0.00001) throw new BadRequestException(`Cupo de ${etiqueta} agotado para esta combinación. Disponible: ${Math.max(0, cupo - vendido).toFixed(2)}.`);
  }

  async listarResultados(sesion: Sesion, fecha?: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const fechaConsulta = this.validarFecha(fecha);
    const resultados = await this.origenDatos.getRepository(Resultado).createQueryBuilder('resultado')
      .innerJoin(HorarioSorteo, 'horario', 'horario.pk_horario_sorteo = resultado.fk_horario_sorteo')
      .innerJoin('horario.sorteo', 'sorteo')
      .innerJoin(Animal, 'animal', 'animal.pk_animal = resultado.fk_animal')
      .select(['resultado.pk_resultado AS pk_resultado', 'horario.hora AS hora', 'sorteo.nombre AS sorteo', 'animal.codigo_animal AS codigo_animal', 'animal.nombre AS nombre_animal', 'animal.icono AS icono_animal'])
      .where('resultado.fecha_juego = :fecha AND resultado.fk_banquero = :fk_banquero', { fecha: fechaConsulta, fk_banquero: agencia.fk_banquero })
      .orderBy('horario.hora', 'ASC')
      .getRawMany();
    if (resultados.length || fechaConsulta !== this.validarFecha()) return resultados;
    return [
      { pk_resultado: 'demostracion-1', hora: '12:00:00', sorteo: 'Lotto Activo', codigo_animal: '05', nombre_animal: 'León', icono_animal: '🦁', es_demostracion: true },
      { pk_resultado: 'demostracion-2', hora: '14:00:00', sorteo: 'La Granjita', codigo_animal: '18', nombre_animal: 'Burro', icono_animal: '🐴', es_demostracion: true },
      { pk_resultado: 'demostracion-3', hora: '16:30:00', sorteo: 'Lotto Internacional', codigo_animal: '29', nombre_animal: 'Elefante', icono_animal: '🐘', es_demostracion: true },
    ];
  }

  async listarTickets(sesion: Sesion, estado?: string, desde?: string, hasta?: string) {
    const agencia = await this.obtenerAgencia(sesion);
    if (estado && !Object.values(EstadoTicket).includes(estado as EstadoTicket)) throw new BadRequestException('El estado de ticket no es válido.');
    const fechaDesde = this.validarFecha(desde);
    const fechaHasta = this.validarFecha(hasta ?? desde);
    if (fechaDesde > fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    return this.repositorioTickets.find({ where: { fk_agencia: agencia.pk_agencia, fecha_juego: Between(fechaDesde, fechaHasta), ...(estado ? { estado: estado as EstadoTicket } : {}) }, relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } }, order: { creado_at: 'DESC' }, take: 100 });
  }

  async buscarTicket(sesion: Sesion, fecha?: string, numero?: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const fechaJuego = this.validarFecha(fecha);
    const numeroTicket = Number(numero);
    if (!Number.isInteger(numeroTicket) || numeroTicket < 1) throw new BadRequestException('Ingresa un número de ticket válido.');
    const ticket = await this.repositorioTickets.findOne({ where: { fk_agencia: agencia.pk_agencia, fecha_juego: fechaJuego, numero_ticket: numeroTicket }, relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } } });
    if (!ticket) throw new NotFoundException('No se encontró ese ticket para la fecha indicada.');
    return ticket;
  }

  private async premioTicket(agencia: Agencia, ticket: Ticket, resultados: Repository<Resultado>): Promise<{ total_premio: number; ids_ganadores: string[] }> {
    const resultadosDelDia = await resultados.find({ where: { fecha_juego: ticket.fecha_juego, fk_banquero: agencia.fk_banquero } });
    const ganadoresPorHorario = new Map(resultadosDelDia.map((resultado) => [resultado.fk_horario_sorteo, resultado.fk_animal]));
    const ganadoras = ticket.jugadas.filter((jugada) => ganadoresPorHorario.get(jugada.fk_horario_sorteo) === jugada.fk_animal);
    const total_premio = Math.round(ganadoras.reduce((total, jugada) => total + Number(jugada.monto) * 30, 0) * 100) / 100;
    return { total_premio, ids_ganadores: ganadoras.map((jugada) => jugada.pk_jugada_ticket) };
  }

  async consultarPago(sesion: Sesion, serial: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const ticket = await this.repositorioTickets.findOne({ where: { serial, fk_agencia: agencia.pk_agencia }, relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado.');
    if (ticket.estado === EstadoTicket.PAGADO) throw new BadRequestException('Este ticket ya fue pagado.');
    if (ticket.estado === EstadoTicket.CANCELADO) throw new BadRequestException('Un ticket anulado no puede pagarse.');
    const premio = await this.premioTicket(agencia, ticket, this.origenDatos.getRepository(Resultado));
    return { serial: ticket.serial, numero_ticket: ticket.numero_ticket, fecha_juego: ticket.fecha_juego, total_pagar: premio.total_premio, jugadas_premiadas: ticket.jugadas.filter((jugada) => premio.ids_ganadores.includes(jugada.pk_jugada_ticket)) };
  }

  async pagarTicket(sesion: Sesion, serial: string) {
    const agencia = await this.obtenerAgencia(sesion);
    return this.origenDatos.transaction(async (gestor) => {
      const ticket = await gestor.getRepository(Ticket).createQueryBuilder('ticket').setLock('pessimistic_write').leftJoinAndSelect('ticket.jugadas', 'jugadas').where('ticket.serial = :serial AND ticket.fk_agencia = :agencia', { serial, agencia: agencia.pk_agencia }).getOne();
      if (!ticket) throw new NotFoundException('Ticket no encontrado.');
      if (ticket.estado === EstadoTicket.PAGADO) throw new BadRequestException('Este ticket ya fue pagado.');
      if (ticket.estado === EstadoTicket.CANCELADO) throw new BadRequestException('Un ticket anulado no puede pagarse.');
      const premio = await this.premioTicket(agencia, ticket, gestor.getRepository(Resultado));
      if (!premio.total_premio) throw new BadRequestException('Este ticket no tiene jugadas premiadas para pagar.');
      await gestor.getRepository(Ticket).update(ticket.pk_ticket, { estado: EstadoTicket.PAGADO, total_premio: premio.total_premio.toFixed(2), monto_pagado: premio.total_premio.toFixed(2), fk_usuario_modificado: sesion.sub });
      await gestor.getRepository(JugadaTicket).update({ pk_jugada_ticket: In(premio.ids_ganadores) }, { estado: EstadoJugada.PAGADA, fk_usuario_modificado: sesion.sub });
      return { mensaje: `Ticket pagado correctamente: ${premio.total_premio.toFixed(2)}.`, total_pagado: premio.total_premio };
    });
  }

  async resumenVentas(sesion: Sesion, desde?: string, hasta?: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const fechaDesde = this.validarFecha(desde);
    const fechaHasta = this.validarFecha(hasta ?? desde);
    if (fechaDesde > fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    const tickets = await this.repositorioTickets.find({ where: { fk_agencia: agencia.pk_agencia, fecha_juego: Between(fechaDesde, fechaHasta), estado: Not(EstadoTicket.CANCELADO) }, relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } }, order: { creado_at: 'DESC' } });
    const total_vendido = tickets.reduce((total, ticket) => total + Number(ticket.total_jugado), 0);
    const total_premiado = tickets.reduce((total, ticket) => total + Number(ticket.total_premio), 0);
    const porcentaje_comision = Number(agencia.comision_porcentaje);
    const total_comision = Math.round(total_vendido * porcentaje_comision) / 100;
    return { desde: fechaDesde, hasta: fechaHasta, total_vendido, total_premiado, porcentaje_comision, total_comision, resto: total_vendido - total_premiado, tickets };
  }

  private validarFecha(fecha?: string): string {
    const fechaActual = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
    const fechaConsulta = fecha ?? fechaActual;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaConsulta)) throw new BadRequestException('La fecha debe tener el formato AAAA-MM-DD.');
    return fechaConsulta;
  }

  async cancelarTicket(sesion: Sesion, serial: string) {
    const agencia = await this.obtenerAgencia(sesion);
    const ticket = await this.repositorioTickets.findOne({ where: { serial, fk_agencia: agencia.pk_agencia }, relations: { jugadas: true } });
    if (!ticket) throw new NotFoundException('Ticket no encontrado.');
    if (ticket.estado !== EstadoTicket.ACTIVO) throw new BadRequestException('Solo se pueden cancelar tickets activos.');
    if (Date.now() - ticket.creado_at.getTime() > agencia.minutos_cierre * 60_000) throw new BadRequestException('El tiempo para cancelar este ticket ya venció.');
    await this.origenDatos.transaction(async (gestor) => {
      await gestor.getRepository(Ticket).update(ticket.pk_ticket, { estado: EstadoTicket.CANCELADO, fk_usuario_modificado: sesion.sub });
      await gestor.getRepository(JugadaTicket).update({ fk_ticket: ticket.pk_ticket }, { estado: EstadoJugada.CANCELADA, fk_usuario_modificado: sesion.sub });
    });
    return { mensaje: 'Ticket cancelado correctamente.' };
  }
}
