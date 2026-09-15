import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Between, In, Not, Repository } from 'typeorm';
import { Agencia, Animal, EstadoTicket, Grupero, HorarioSorteo, Resultado, Ticket, TipoUsuario, Usuario } from '../base-datos/entidades';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';
import { CrearAgenciaDto } from './dto/crear-agencia.dto';
import { ActualizarAgenciaDto } from './dto/actualizar-agencia.dto';

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
      agencias: agencias.map((agencia) => ({ pk_agencia: agencia.pk_agencia, codigo_agencia: agencia.codigo_agencia, nombre_agencia: agencia.nombre_agencia, activa: agencia.activa, grupero: agencia.fk_grupero, operador: agencia.usuario.nombre_completo, equipo_asignado: Boolean(agencia.serial_pc), comision_porcentaje: agencia.comision_porcentaje, cupo_animal: agencia.cupo_animal, jugada_minima: agencia.jugada_minima, minutos_cierre: agencia.minutos_cierre })),
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

  private async agenciaEnAlcance(alcance: Alcance, pkAgencia: string): Promise<Agencia> {
    const agencia = await this.agencias.findOneBy({ pk_agencia: pkAgencia, fk_banquero: alcance.fk_banquero, ...(alcance.fk_grupero ? { fk_grupero: alcance.fk_grupero } : {}) });
    if (!agencia) throw new ForbiddenException('La agencia no pertenece a tu operación.');
    return agencia;
  }

  private async resolverGrupero(alcance: Alcance, fkGrupero?: string): Promise<string | null> {
    if (alcance.fk_grupero) return alcance.fk_grupero;
    if (!fkGrupero) return null;
    const grupero = await this.gruperos.findOneBy({ pk_grupero: fkGrupero, fk_banquero: alcance.fk_banquero, activo: true });
    if (!grupero) throw new BadRequestException('El grupero seleccionado no pertenece a este banquero o no está activo.');
    return grupero.pk_grupero;
  }

  async crearAgencia(sesion: Sesion, datos: CrearAgenciaDto) {
    const alcance = await this.alcance(sesion);
    const codigo = datos.codigo_agencia.trim().toUpperCase();
    const nombre = datos.nombre_agencia.trim();
    const nombreUsuario = datos.nombre_usuario.trim().toLowerCase();
    if (await this.agencias.existsBy({ codigo_agencia: codigo })) throw new BadRequestException('El código de agencia ya existe.');
    if (await this.usuarios.existsBy({ nombre_usuario: nombreUsuario })) throw new BadRequestException('El usuario de agencia ya existe.');
    const fk_grupero = await this.resolverGrupero(alcance, datos.fk_grupero);
    const hash = await bcrypt.hash(datos.contrasena, 12);
    const creado = await this.agencias.manager.transaction(async (gestor) => {
      const usuario = await gestor.getRepository(Usuario).save(gestor.getRepository(Usuario).create({ nombre_usuario: nombreUsuario, nombre_completo: nombre, hash_contrasena: hash, tipo_usuario: TipoUsuario.AGENCIA, activo: true }));
      return gestor.getRepository(Agencia).save(gestor.getRepository(Agencia).create({
        pk_agencia: randomUUID(), codigo_agencia: codigo, nombre_agencia: nombre,
        comision_porcentaje: (datos.comision_porcentaje ?? 12).toFixed(3), cupo_animal: (datos.cupo_animal ?? 100).toFixed(2), jugada_minima: (datos.jugada_minima ?? 1).toFixed(2), minutos_cierre: datos.minutos_cierre ?? 5,
        serial_pc: null, proximo_numero_ticket: 1, fk_usuario: usuario.pk_usuario, fk_banquero: alcance.fk_banquero, fk_grupero, activa: true, fk_usuario_modificado: sesion.sub,
      }));
    });
    return { mensaje: 'Agencia creada correctamente.', pk_agencia: creado.pk_agencia };
  }

  async actualizarAgencia(sesion: Sesion, pkAgencia: string, datos: ActualizarAgenciaDto) {
    const alcance = await this.alcance(sesion);
    const agencia = await this.agenciaEnAlcance(alcance, pkAgencia);
    const fk_grupero = datos.fk_grupero === undefined ? agencia.fk_grupero : await this.resolverGrupero(alcance, datos.fk_grupero);
    await this.agencias.update(agencia.pk_agencia, {
      ...(datos.nombre_agencia !== undefined ? { nombre_agencia: datos.nombre_agencia.trim() } : {}),
      ...(datos.comision_porcentaje !== undefined ? { comision_porcentaje: datos.comision_porcentaje.toFixed(3) } : {}),
      ...(datos.cupo_animal !== undefined ? { cupo_animal: datos.cupo_animal.toFixed(2) } : {}),
      ...(datos.jugada_minima !== undefined ? { jugada_minima: datos.jugada_minima.toFixed(2) } : {}),
      ...(datos.minutos_cierre !== undefined ? { minutos_cierre: datos.minutos_cierre } : {}),
      ...(datos.activa !== undefined ? { activa: datos.activa } : {}), fk_grupero, fk_usuario_modificado: sesion.sub,
    });
    return { mensaje: 'Agencia actualizada correctamente.' };
  }

  async desactivarAgencia(sesion: Sesion, pkAgencia: string) {
    const alcance = await this.alcance(sesion);
    const agencia = await this.agenciaEnAlcance(alcance, pkAgencia);
    await this.agencias.manager.transaction(async (gestor) => {
      await gestor.getRepository(Agencia).update(agencia.pk_agencia, { activa: false, fk_usuario_modificado: sesion.sub });
      await gestor.getRepository(Usuario).update(agencia.fk_usuario, { activo: false });
    });
    return { mensaje: 'Agencia desactivada. Se conserva su historial de tickets.' };
  }

  async liberarSerial(sesion: Sesion, pkAgencia: string) {
    const alcance = await this.alcance(sesion);
    const agencia = await this.agenciaEnAlcance(alcance, pkAgencia);
    if (!agencia.serial_pc) return { mensaje: 'La taquilla no tiene un equipo asignado.' };
    await this.agencias.update(agencia.pk_agencia, { serial_pc: null });
    return { mensaje: 'Equipo liberado. La próxima sesión de la taquilla asignará el nuevo equipo.' };
  }
}
