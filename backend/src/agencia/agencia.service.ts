import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, In, Repository } from 'typeorm';
import { EstadoJugada, EstadoTicket, Agencia, Animal, Grupero, HorarioSorteo, JugadaTicket, Ticket, TipoUsuario } from '../base-datos/entidades';
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

  private validarJugadas(datos: CrearVentaDto, animales: Animal[], horarios: HorarioSorteo[], agencia: Agencia): void {
    const animalesValidos = new Set(animales.map((animal) => animal.pk_animal));
    const horariosPorId = new Map(horarios.map((horario) => [horario.pk_horario_sorteo, horario]));
    const combinaciones = new Set<string>();
    for (const jugada of datos.jugadas) {
      if (!animalesValidos.has(jugada.fk_animal)) throw new BadRequestException('Uno de los animales ya no está disponible.');
      const horario = horariosPorId.get(jugada.fk_horario_sorteo);
      if (!horario) throw new BadRequestException('Uno de los sorteos ya no está disponible.');
      if (jugada.monto < Number(agencia.jugada_minima)) throw new BadRequestException(`La jugada mínima es ${agencia.jugada_minima}.`);
      const clave = `${jugada.fk_animal}-${jugada.fk_horario_sorteo}`;
      if (combinaciones.has(clave)) throw new BadRequestException('No repitas el mismo animal en el mismo sorteo dentro de un ticket.');
      combinaciones.add(clave);
      this.validarCierre(horario, agencia.minutos_cierre);
    }
  }

  async crearVenta(sesion: Sesion, datos: CrearVentaDto) {
    const agencia = await this.obtenerAgencia(sesion);
    const [animales, horarios] = await Promise.all([
      this.repositorioAnimales.find({ where: { pk_animal: In(datos.jugadas.map((jugada) => jugada.fk_animal)), activo: true } }),
      this.repositorioHorarios.find({ where: { pk_horario_sorteo: In(datos.jugadas.map((jugada) => jugada.fk_horario_sorteo)), activo: true }, relations: { sorteo: true } }),
    ]);
    this.validarJugadas(datos, animales, horarios, agencia);
    const fechaJuego = new Date().toISOString().slice(0, 10);

    return this.origenDatos.transaction(async (gestor) => {
      // Bloquear la Agencia evita números de ticket duplicados y ventas concurrentes locales.
      const agenciaBloqueada = await gestor.getRepository(Agencia).createQueryBuilder('agencia').setLock('pessimistic_write').where('agencia.pk_agencia = :pk_agencia', { pk_agencia: agencia.pk_agencia }).getOneOrFail();
      const agenciasDelGrupo = agenciaBloqueada.fk_grupero
        ? await gestor.getRepository(Agencia).createQueryBuilder('agencia').setLock('pessimistic_write').where('agencia.fk_grupero = :fk_grupero', { fk_grupero: agenciaBloqueada.fk_grupero }).getMany()
        : [agenciaBloqueada];
      const idsAgenciasGrupo = agenciasDelGrupo.map((item) => item.pk_agencia);

      for (const jugada of datos.jugadas) {
        await this.validarCupo(gestor, jugada, fechaJuego, [agenciaBloqueada.pk_agencia], Number(agenciaBloqueada.cupo_animal), 'Agencia');
        if (agenciaBloqueada.fk_grupero) {
          const grupero = await gestor.getRepository(Grupero).createQueryBuilder('grupero').setLock('pessimistic_write').where('grupero.pk_grupero = :pk_grupero', { pk_grupero: agenciaBloqueada.fk_grupero }).getOneOrFail();
          await this.validarCupo(gestor, jugada, fechaJuego, idsAgenciasGrupo, Number(grupero.cupo_animal), 'Grupero');
        }
      }

      const totalJugado = datos.jugadas.reduce((total, jugada) => total + Math.round(jugada.monto * 100), 0) / 100;
      const ticket = gestor.getRepository(Ticket).create({
        pk_ticket: randomUUID(),
        serial: `AG-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
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
      await gestor.save(datos.jugadas.map((jugada) => gestor.getRepository(JugadaTicket).create({
        pk_jugada_ticket: randomUUID(), fk_ticket: ticket.pk_ticket, fk_animal: jugada.fk_animal, fk_horario_sorteo: jugada.fk_horario_sorteo, fecha_juego: fechaJuego, monto: jugada.monto.toFixed(2), estado: EstadoJugada.ACTIVA, fk_usuario_modificado: sesion.sub,
      })));
      return { serial: ticket.serial, numero_ticket: ticket.numero_ticket, total_jugado: totalJugado, creado_at: ticket.creado_at };
    });
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

  async listarTickets(sesion: Sesion) {
    const agencia = await this.obtenerAgencia(sesion);
    return this.repositorioTickets.find({ where: { fk_agencia: agencia.pk_agencia }, relations: { jugadas: { animal: true, horario_sorteo: { sorteo: true } } }, order: { creado_at: 'DESC' }, take: 30 });
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
