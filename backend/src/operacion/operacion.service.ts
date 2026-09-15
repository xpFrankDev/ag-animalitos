import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Between, In, Not, Repository } from 'typeorm';
import { Agencia, Animal, EstadoTicket, Grupero, HorarioSorteo, Resultado, Ticket, TipoUsuario, Usuario } from '../base-datos/entidades';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';

type Sesion = { sub: string; tipo_usuario: TipoUsuario };
type Alcance = { fk_banquero: string; fk_grupero?: string; es_banquero: boolean };

@Injectable()
export class OperacionService {
  constructor(
    @InjectRepository(Agencia) private readonly agencias: Repository<Agencia>,
    @InjectRepository(Animal) private readonly animales: Repository<Animal>,
    @InjectRepository(Grupero) private readonly gruperos: Repository<Grupero>,
    @InjectRepository(HorarioSorteo) private readonly horarios: Repository<HorarioSorteo>,
    @InjectRepository(Resultado) private readonly resultados: Repository<Resultado>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(Usuario) private readonly usuarios: Repository<Usuario>,
  ) {}

  private async alcance(sesion: Sesion): Promise<Alcance> {
    if (sesion.tipo_usuario === TipoUsuario.BANQUERO) return { fk_banquero: sesion.sub, es_banquero: true };
    if (sesion.tipo_usuario === TipoUsuario.GRUPERO) {
      const grupero = await this.gruperos.findOneBy({ fk_usuario: sesion.sub, activo: true });
      if (!grupero) throw new ForbiddenException('El usuario no tiene un grupero activo asociado.');
      return { fk_banquero: grupero.fk_banquero, fk_grupero: grupero.pk_grupero, es_banquero: false };
    }
    throw new ForbiddenException('Este módulo es exclusivo para Banqueros y Gruperos.');
  }

  private fecha(fecha?: string): string {
    const valor = fecha ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new BadRequestException('La fecha debe tener formato AAAA-MM-DD.');
    return valor;
  }

  async inicio(sesion: Sesion, desde?: string, hasta?: string) {
    const alcance = await this.alcance(sesion);
    const fechaDesde = this.fecha(desde);
    const fechaHasta = this.fecha(hasta ?? desde);
    if (fechaDesde > fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    const filtroAgencia = { fk_banquero: alcance.fk_banquero, ...(alcance.fk_grupero ? { fk_grupero: alcance.fk_grupero } : {}) };
    const agencias = await this.agencias.find({ where: filtroAgencia, relations: { usuario: true }, order: { nombre_agencia: 'ASC' } });
    const idsAgencias = agencias.map((agencia) => agencia.pk_agencia);
    const tickets = idsAgencias.length ? await this.tickets.find({ where: { fk_agencia: In(idsAgencias), fecha_juego: Between(fechaDesde, fechaHasta) }, relations: { agencia: true }, order: { creado_at: 'DESC' }, take: 100 }) : [];
    const resultados = await this.resultados.createQueryBuilder('resultado')
      .innerJoin(HorarioSorteo, 'horario', 'horario.pk_horario_sorteo = resultado.fk_horario_sorteo')
      .innerJoin('horario.sorteo', 'sorteo').innerJoin(Animal, 'animal', 'animal.pk_animal = resultado.fk_animal')
      .select(['resultado.pk_resultado AS pk_resultado', 'resultado.fecha_juego AS fecha_juego', 'horario.hora AS hora', 'sorteo.nombre AS sorteo', 'animal.codigo_animal AS codigo_animal', 'animal.nombre AS nombre_animal', 'animal.icono AS icono_animal'])
      .where('resultado.fk_banquero = :fk_banquero AND resultado.fecha_juego BETWEEN :desde AND :hasta', { fk_banquero: alcance.fk_banquero, desde: fechaDesde, hasta: fechaHasta })
      .orderBy('resultado.fecha_juego', 'DESC').addOrderBy('horario.hora', 'ASC').getRawMany();
    const gruperos = alcance.es_banquero ? await this.gruperos.find({ where: { fk_banquero: alcance.fk_banquero }, relations: { usuario: true }, order: { usuario: { nombre_completo: 'ASC' } } }) : [];
    const total_vendido = tickets.filter((ticket) => ticket.estado !== EstadoTicket.CANCELADO).reduce((total, ticket) => total + Number(ticket.total_jugado), 0);
    const total_premiado = tickets.reduce((total, ticket) => total + Number(ticket.total_premio), 0);
    const usuario = await this.usuarios.findOneByOrFail({ pk_usuario: sesion.sub });
    return {
      perfil: { nombre_completo: usuario.nombre_completo, tipo_usuario: sesion.tipo_usuario },
      permisos: { puede_registrar_resultados: alcance.es_banquero },
      rango: { desde: fechaDesde, hasta: fechaHasta },
      resumen: { total_vendido, total_premiado, tickets: tickets.length, agencias: agencias.length },
      agencias: agencias.map((agencia) => ({ pk_agencia: agencia.pk_agencia, codigo_agencia: agencia.codigo_agencia, nombre_agencia: agencia.nombre_agencia, activa: agencia.activa, grupero: agencia.fk_grupero, operador: agencia.usuario.nombre_completo, equipo_asignado: Boolean(agencia.serial_pc) })),
      gruperos: gruperos.map((grupero) => ({ pk_grupero: grupero.pk_grupero, nombre_completo: grupero.usuario.nombre_completo, activo: grupero.activo })),
      tickets: tickets.map((ticket) => ({ serial: ticket.serial, numero_ticket: ticket.numero_ticket, fecha_juego: ticket.fecha_juego, estado: ticket.estado, total_jugado: ticket.total_jugado, total_premio: ticket.total_premio, agencia: ticket.agencia.nombre_agencia })),
      resultados,
    };
  }

  async catalogoResultados(sesion: Sesion) {
    const alcance = await this.alcance(sesion);
    if (!alcance.es_banquero) throw new ForbiddenException('Solo el Banquero puede registrar resultados.');
    const [animales, horarios] = await Promise.all([
      this.animales.find({ where: { activo: true }, order: { codigo_animal: 'ASC' } }),
      this.horarios.find({ where: { activo: true }, relations: { sorteo: true }, order: { hora: 'ASC' } }),
    ]);
    return { animales, horarios: horarios.map((horario) => ({ pk_horario_sorteo: horario.pk_horario_sorteo, hora: horario.hora.slice(0, 5), sorteo: horario.sorteo.nombre })) };
  }

  async registrarResultado(sesion: Sesion, datos: RegistrarResultadoDto) {
    const alcance = await this.alcance(sesion);
    if (!alcance.es_banquero) throw new ForbiddenException('Solo el Banquero puede registrar resultados.');
    const fecha_juego = this.fecha(datos.fecha_juego);
    const [horario, animal] = await Promise.all([this.horarios.findOneBy({ pk_horario_sorteo: datos.fk_horario_sorteo, activo: true }), this.animales.findOneBy({ pk_animal: datos.fk_animal, activo: true })]);
    if (!horario || !animal) throw new BadRequestException('El sorteo o animal seleccionado no está disponible.');
    const existente = await this.resultados.findOneBy({ fecha_juego, fk_horario_sorteo: horario.pk_horario_sorteo, fk_banquero: alcance.fk_banquero });
    if (existente) {
      await this.resultados.update(existente.pk_resultado, { fk_animal: animal.pk_animal, fk_usuario_modificado: sesion.sub });
      return { mensaje: 'Resultado actualizado.' };
    }
    await this.resultados.save(this.resultados.create({ pk_resultado: randomUUID(), fecha_juego, fk_horario_sorteo: horario.pk_horario_sorteo, fk_animal: animal.pk_animal, fk_banquero: alcance.fk_banquero, insertado_at: new Date(), fk_usuario_modificado: sesion.sub }));
    return { mensaje: 'Resultado registrado.' };
  }

  async liberarSerial(sesion: Sesion, pkAgencia: string) {
    const alcance = await this.alcance(sesion);
    const agencia = await this.agencias.findOneBy({ pk_agencia: pkAgencia, fk_banquero: alcance.fk_banquero, ...(alcance.fk_grupero ? { fk_grupero: alcance.fk_grupero } : {}) });
    if (!agencia) throw new ForbiddenException('La agencia no pertenece a tu operación.');
    if (!agencia.serial_pc) return { mensaje: 'La taquilla no tiene un equipo asignado.' };
    await this.agencias.update(agencia.pk_agencia, { serial_pc: null });
    return { mensaje: 'Equipo liberado. La próxima sesión de la taquilla asignará el nuevo equipo.' };
  }
}
