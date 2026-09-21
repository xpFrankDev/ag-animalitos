import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Between, In, Repository } from 'typeorm';
import {
  Agencia,
  Animal,
  EstadoTicket,
  Grupero,
  HorarioSorteo,
  OrigenResultado,
  Resultado,
  Ticket,
  TipoUsuario,
  Usuario,
} from '../base-datos/entidades';
import { ControlAccesoService } from '../autenticacion/control-acceso.service';
import { redondear2, calcularComision, sumarMontos } from '../comun/dinero';
import { resolverFecha } from '../comun/fechas';
import { ActualizarAgenciaDto } from './dto/actualizar-agencia.dto';
import { CrearAgenciaDto } from './dto/crear-agencia.dto';
import { ActualizarGruperoDto, CrearGruperoDto } from './dto/grupero.dto';
import { RegistrarResultadoDto } from './dto/registrar-resultado.dto';

type Sesion = { sub: string; tipo_usuario: TipoUsuario };
type Alcance = { fk_banquero: string; fk_grupero?: string; es_banquero: boolean };
type FiltrosPanel = { desde?: string; hasta?: string; pagina?: number; tamano?: number };

const TAMANO_PAGINA_POR_DEFECTO = 25;
const TAMANO_PAGINA_MAXIMO = 100;

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
    private readonly controlAcceso: ControlAccesoService,
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

  private filtroAgencias(alcance: Alcance) {
    return { fk_banquero: alcance.fk_banquero, ...(alcance.fk_grupero ? { fk_grupero: alcance.fk_grupero } : {}) };
  }

  async inicio(sesion: Sesion, filtros: FiltrosPanel = {}) {
    const alcance = await this.alcance(sesion);
    const fechaDesde = resolverFecha(filtros.desde);
    const fechaHasta = resolverFecha(filtros.hasta ?? filtros.desde);
    if (fechaDesde > fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');

    const agencias = await this.agencias.find({ where: this.filtroAgencias(alcance), relations: { usuario: true }, order: { nombre_agencia: 'ASC' } });
    const idsAgencias = agencias.map((agencia) => agencia.pk_agencia);
    const totalTickets = idsAgencias.length
      ? await this.tickets.count({ where: { fk_agencia: In(idsAgencias), fecha_juego: Between(fechaDesde, fechaHasta) } })
      : 0;

    const gruperosDelAlcance = alcance.es_banquero
      ? await this.gruperos.find({
          where: { fk_banquero: alcance.fk_banquero },
          relations: { usuario: true },
          order: { activo: 'DESC' },
        })
      : await this.gruperos.find({ where: { pk_grupero: alcance.fk_grupero! }, relations: { usuario: true } });
    const agenciasPorGrupero = new Map<string, number>();
    for (const agencia of agencias) {
      if (!agencia.fk_grupero) continue;
      agenciasPorGrupero.set(agencia.fk_grupero, (agenciasPorGrupero.get(agencia.fk_grupero) ?? 0) + 1);
    }

    const { resumen, ventasPorAgencia } = await this.resumenVentas(idsAgencias, agencias, fechaDesde, fechaHasta);
    // La comisión del grupero se calcula sobre la venta acumulada de todas sus agencias.
    const ventasPorGrupero = new Map<string, number>();
    for (const agencia of agencias) {
      if (!agencia.fk_grupero) continue;
      ventasPorGrupero.set(
        agencia.fk_grupero,
        sumarMontos([ventasPorGrupero.get(agencia.fk_grupero) ?? 0, ventasPorAgencia.get(agencia.pk_agencia) ?? 0]),
      );
    }
    const comision_gruperos = redondear2(
      gruperosDelAlcance.reduce(
        (total, grupero) => total + calcularComision(ventasPorGrupero.get(grupero.pk_grupero) ?? 0, Number(grupero.comision_porcentaje)),
        0,
      ),
    );
    const usuario = await this.usuarios.findOneByOrFail({ pk_usuario: sesion.sub });
    return {
      perfil: { nombre_completo: usuario.nombre_completo, tipo_usuario: sesion.tipo_usuario },
      permisos: {
        puede_registrar_resultados: alcance.es_banquero,
        puede_gestionar_gruperos: alcance.es_banquero,
        puede_definir_comision: alcance.es_banquero,
        alcance: alcance.es_banquero ? 'RED' : 'GRUPO',
      },
      rango: { desde: fechaDesde, hasta: fechaHasta },
      resumen: { ...resumen, comision_gruperos, agencias: agencias.length, tickets: totalTickets },
      agencias: agencias.map((agencia) => ({
        pk_agencia: agencia.pk_agencia,
        codigo_agencia: agencia.codigo_agencia,
        nombre_agencia: agencia.nombre_agencia,
        activa: agencia.activa,
        grupero: agencia.fk_grupero,
        operador: agencia.usuario.nombre_completo,
        equipo_asignado: Boolean(agencia.serial_pc),
        equipo: agencia.serial_pc,
        comision_porcentaje: Number(agencia.comision_porcentaje),
        cupo_animal: Number(agencia.cupo_animal),
        jugada_minima: Number(agencia.jugada_minima),
        minutos_cierre: agencia.minutos_cierre,
      })),
      gruperos: (alcance.es_banquero ? gruperosDelAlcance : []).map((grupero) => ({
        pk_grupero: grupero.pk_grupero,
        nombre_completo: grupero.usuario.nombre_completo,
        nombre_usuario: grupero.usuario.nombre_usuario,
        activo: grupero.activo,
        cupo_animal: Number(grupero.cupo_animal),
        comision_porcentaje: Number(grupero.comision_porcentaje),
        agencias: agenciasPorGrupero.get(grupero.pk_grupero) ?? 0,
        venta_grupo: ventasPorGrupero.get(grupero.pk_grupero) ?? 0,
        comision_grupo: calcularComision(ventasPorGrupero.get(grupero.pk_grupero) ?? 0, Number(grupero.comision_porcentaje)),
      })),
    };
  }

  /** Tickets de la red o del grupo, paginados y filtrables por agencia y estado. */
  async listarTickets(sesion: Sesion, filtros: FiltrosPanel & { agencia?: string; estado?: string }) {
    const alcance = await this.alcance(sesion);
    const fechaDesde = resolverFecha(filtros.desde);
    const fechaHasta = resolverFecha(filtros.hasta ?? filtros.desde);
    if (fechaDesde > fechaHasta) throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const tamano = Math.min(TAMANO_PAGINA_MAXIMO, Math.max(1, Number(filtros.tamano) || TAMANO_PAGINA_POR_DEFECTO));
    const agencias = await this.agencias.find({ where: this.filtroAgencias(alcance), select: { pk_agencia: true } });
    const idsAlcance = agencias.map((agencia) => agencia.pk_agencia);
    const agenciaFiltro = filtros.agencia?.trim() || undefined;
    if (agenciaFiltro && !idsAlcance.includes(agenciaFiltro)) {
      throw new ForbiddenException('La agencia no pertenece a tu operación.');
    }
    const idsConsulta = agenciaFiltro ? [agenciaFiltro] : idsAlcance;
    const estado = Object.values(EstadoTicket).includes(filtros.estado as EstadoTicket)
      ? (filtros.estado as EstadoTicket)
      : undefined;
    const [tickets, total] = idsConsulta.length
      ? await this.tickets.findAndCount({
          where: {
            fk_agencia: In(idsConsulta),
            fecha_juego: Between(fechaDesde, fechaHasta),
            ...(estado ? { estado } : {}),
          },
          relations: { agencia: true },
          order: { fecha_juego: 'DESC', numero_ticket: 'DESC' },
          skip: (pagina - 1) * tamano,
          take: tamano,
        })
      : [[], 0];
    return {
      tickets: tickets.map((ticket) => ({
        serial: ticket.serial,
        numero_ticket: ticket.numero_ticket,
        fecha_juego: ticket.fecha_juego,
        estado: ticket.estado,
        total_jugado: ticket.total_jugado,
        total_premio: ticket.total_premio,
        agencia: ticket.agencia.nombre_agencia,
      })),
      total,
      pagina,
      tamano,
      tiene_mas: pagina * tamano < total,
    };
  }

  /** Resultados de un día, ordenados por hora de sorteo, para la sección de resultados. */
  async listarResultados(sesion: Sesion, fecha?: string) {
    await this.alcance(sesion);
    const fechaJuego = resolverFecha(fecha);
    const resultados = await this.resultados
      .createQueryBuilder('resultado')
      .innerJoin(HorarioSorteo, 'horario', 'horario.pk_horario_sorteo = resultado.fk_horario_sorteo')
      .innerJoin('horario.sorteo', 'sorteo')
      .innerJoin(Animal, 'animal', 'animal.pk_animal = resultado.fk_animal')
      .select([
        'resultado.pk_resultado AS pk_resultado',
        'resultado.fecha_juego AS fecha_juego',
        'resultado.origen AS origen',
        'resultado.aplicado_at AS aplicado_at',
        'horario.hora AS hora',
        'sorteo.nombre AS sorteo',
        'animal.codigo_animal AS codigo_animal',
        'animal.nombre AS nombre_animal',
        'animal.icono AS icono_animal',
      ])
      .where('resultado.fecha_juego = :fecha', { fecha: fechaJuego })
      .orderBy('horario.hora', 'ASC')
      .getRawMany();
    return {
      fecha: fechaJuego,
      resultados: resultados.map((resultado) => ({ ...resultado, aplicado: Boolean(resultado.aplicado_at) })),
    };
  }

  /** Comisiones variables: cada agencia tiene el porcentaje que le asignó el banquero. */
  private async resumenVentas(idsAgencias: string[], agencias: Agencia[], desde: string, hasta: string) {
    const ventasPorAgencia = new Map<string, number>();
    if (!idsAgencias.length) {
      return {
        resumen: { total_vendido: 0, total_premiado: 0, total_comision: 0, resto: 0 },
        ventasPorAgencia,
      };
    }
    const filas = await this.tickets
      .createQueryBuilder('ticket')
      .select('ticket.fk_agencia', 'fk_agencia')
      .addSelect('COALESCE(SUM(ticket.total_jugado), 0)', 'vendido')
      .addSelect('COALESCE(SUM(ticket.total_premio), 0)', 'premiado')
      .where('ticket.fk_agencia IN (:...idsAgencias)', { idsAgencias })
      .andWhere('ticket.fecha_juego BETWEEN :desde AND :hasta', { desde, hasta })
      .andWhere('ticket.estado <> :cancelado', { cancelado: EstadoTicket.CANCELADO })
      .groupBy('ticket.fk_agencia')
      .getRawMany<{ fk_agencia: string; vendido: string; premiado: string }>();
    const porcentajePorAgencia = new Map(agencias.map((agencia) => [agencia.pk_agencia, Number(agencia.comision_porcentaje)]));
    for (const fila of filas) ventasPorAgencia.set(fila.fk_agencia, redondear2(Number(fila.vendido)));
    const total_vendido = sumarMontos(filas.map((fila) => Number(fila.vendido)));
    const total_premiado = sumarMontos(filas.map((fila) => Number(fila.premiado)));
    const total_comision = redondear2(
      filas.reduce(
        (total, fila) => total + calcularComision(Number(fila.vendido), porcentajePorAgencia.get(fila.fk_agencia) ?? 0),
        0,
      ),
    );
    return {
      resumen: { total_vendido, total_premiado, total_comision, resto: sumarMontos([total_vendido, -total_premiado]) },
      ventasPorAgencia,
    };
  }

  async catalogoResultados(sesion: Sesion) {
    const alcance = await this.alcance(sesion);
    if (!alcance.es_banquero) throw new ForbiddenException('Solo el Banquero puede registrar resultados.');
    const [animales, horarios] = await Promise.all([
      this.animales.find({ where: { activo: true }, order: { codigo_animal: 'ASC' } }),
      this.horarios.find({ where: { activo: true }, relations: { sorteo: true }, order: { hora: 'ASC' } }),
    ]);
    return {
      animales,
      horarios: horarios.map((horario) => ({
        pk_horario_sorteo: horario.pk_horario_sorteo,
        hora: horario.hora.slice(0, 5),
        sorteo: horario.sorteo.nombre,
        multiplicador_premio: Number(horario.sorteo.multiplicador_premio),
      })),
    };
  }

  /**
   * Registro manual: contingencia para cuando la recolección automática no pudo obtener
   * un resultado. Se guarda con origen MANUAL y la calificación lo aplica igual que a los
   * automáticos, recalculando los tickets del horario.
   */
  async registrarResultado(sesion: Sesion, datos: RegistrarResultadoDto) {
    const alcance = await this.alcance(sesion);
    if (!alcance.es_banquero) throw new ForbiddenException('Solo el Banquero puede registrar resultados.');
    const fecha_juego = resolverFecha(datos.fecha_juego);
    const [horario, animal] = await Promise.all([
      this.horarios.findOneBy({ pk_horario_sorteo: datos.fk_horario_sorteo, activo: true }),
      this.animales.findOneBy({ pk_animal: datos.fk_animal, activo: true }),
    ]);
    if (!horario || !animal) throw new BadRequestException('El sorteo o animal seleccionado no está disponible.');
    const existente = await this.resultados.findOneBy({ fecha_juego, fk_horario_sorteo: horario.pk_horario_sorteo });
    if (existente) {
      await this.resultados.update(existente.pk_resultado, {
        fk_animal: animal.pk_animal,
        origen: OrigenResultado.MANUAL,
        aplicado_at: null,
        fk_usuario_modificado: sesion.sub,
      });
      return { mensaje: 'Resultado actualizado. Los tickets del horario se recalcularán automáticamente.' };
    }
    await this.resultados.save(
      this.resultados.create({
        pk_resultado: randomUUID(),
        fecha_juego,
        fk_horario_sorteo: horario.pk_horario_sorteo,
        fk_animal: animal.pk_animal,
        origen: OrigenResultado.MANUAL,
        insertado_at: new Date(),
        aplicado_at: null,
        fk_usuario_modificado: sesion.sub,
      }),
    );
    return { mensaje: 'Resultado registrado. Los tickets del horario se recalcularán automáticamente.' };
  }

  /**
   * Elimina un resultado manual que todavía no se aplicó a los tickets. Si ya se aplicó,
   * el camino correcto es registrar el resultado válido para que la calificación recalcule.
   */
  async eliminarResultado(sesion: Sesion, pkResultado: string) {
    const alcance = await this.alcance(sesion);
    if (!alcance.es_banquero) throw new ForbiddenException('Solo el Banquero puede eliminar resultados.');
    const resultado = await this.resultados.findOneBy({ pk_resultado: pkResultado });
    if (!resultado) throw new BadRequestException('El resultado ya no existe.');
    if (resultado.origen !== OrigenResultado.MANUAL) {
      throw new BadRequestException('Solo se pueden eliminar resultados registrados manualmente.');
    }
    if (resultado.aplicado_at) {
      throw new BadRequestException('El resultado ya se aplicó a los tickets. Registra el resultado correcto para recalcular los premios.');
    }
    await this.resultados.delete(resultado.pk_resultado);
    return { mensaje: 'Resultado manual eliminado.' };
  }

  private async agenciaEnAlcance(alcance: Alcance, pkAgencia: string): Promise<Agencia> {
    const agencia = await this.agencias.findOneBy({ pk_agencia: pkAgencia, ...this.filtroAgencias(alcance) });
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
      const usuario = await gestor.getRepository(Usuario).save(
        gestor.getRepository(Usuario).create({
          nombre_usuario: nombreUsuario,
          nombre_completo: nombre,
          hash_contrasena: hash,
          tipo_usuario: TipoUsuario.AGENCIA,
          activo: true,
        }),
      );
      return gestor.getRepository(Agencia).save(
        gestor.getRepository(Agencia).create({
          pk_agencia: randomUUID(),
          codigo_agencia: codigo,
          nombre_agencia: nombre,
          comision_porcentaje: (datos.comision_porcentaje ?? 12).toFixed(3),
          cupo_animal: (datos.cupo_animal ?? 100).toFixed(2),
          jugada_minima: (datos.jugada_minima ?? 1).toFixed(2),
          minutos_cierre: datos.minutos_cierre ?? 5,
          serial_pc: null,
          proximo_numero_ticket: 1,
          fecha_numero_ticket: null,
          fk_usuario: usuario.pk_usuario,
          fk_banquero: alcance.fk_banquero,
          fk_grupero,
          activa: true,
          fk_usuario_modificado: sesion.sub,
        }),
      );
    });
    return { mensaje: 'Agencia creada correctamente.', pk_agencia: creado.pk_agencia };
  }

  async actualizarAgencia(sesion: Sesion, pkAgencia: string, datos: ActualizarAgenciaDto) {
    const alcance = await this.alcance(sesion);
    const agencia = await this.agenciaEnAlcance(alcance, pkAgencia);
    if (!alcance.es_banquero && datos.comision_porcentaje !== undefined) {
      throw new ForbiddenException('La comisión de la agencia la define el banquero.');
    }
    if (!alcance.es_banquero && datos.fk_grupero !== undefined && datos.fk_grupero !== agencia.fk_grupero) {
      throw new ForbiddenException('Solo el banquero puede reasignar una agencia a otro grupero.');
    }
    const fk_grupero = alcance.es_banquero
      ? datos.fk_grupero === undefined
        ? agencia.fk_grupero
        : await this.resolverGrupero(alcance, datos.fk_grupero)
      : agencia.fk_grupero;
    await this.agencias.update(agencia.pk_agencia, {
      ...(datos.nombre_agencia !== undefined ? { nombre_agencia: datos.nombre_agencia.trim() } : {}),
      ...(alcance.es_banquero && datos.comision_porcentaje !== undefined
        ? { comision_porcentaje: datos.comision_porcentaje.toFixed(3) }
        : {}),
      ...(datos.cupo_animal !== undefined ? { cupo_animal: datos.cupo_animal.toFixed(2) } : {}),
      ...(datos.jugada_minima !== undefined ? { jugada_minima: datos.jugada_minima.toFixed(2) } : {}),
      ...(datos.minutos_cierre !== undefined ? { minutos_cierre: datos.minutos_cierre } : {}),
      ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
      fk_grupero,
      fk_usuario_modificado: sesion.sub,
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
    await this.agencias.update(agencia.pk_agencia, { serial_pc: null, fk_usuario_modificado: sesion.sub });
    return { mensaje: 'Equipo liberado. La próxima sesión de la taquilla asignará el nuevo equipo.' };
  }

  async crearGrupero(sesion: Sesion, datos: CrearGruperoDto) {
    const alcance = await this.alcance(sesion);
    if (!alcance.es_banquero) throw new ForbiddenException('Solo el Banquero puede crear gruperos.');
    const nombreUsuario = datos.nombre_usuario.trim().toLowerCase();
    if (await this.usuarios.existsBy({ nombre_usuario: nombreUsuario })) throw new BadRequestException('El usuario ya existe.');
    const hash = await bcrypt.hash(datos.contrasena, 12);
    const creado = await this.gruperos.manager.transaction(async (gestor) => {
      const usuario = await gestor.getRepository(Usuario).save(
        gestor.getRepository(Usuario).create({
          nombre_usuario: nombreUsuario,
          nombre_completo: datos.nombre_completo.trim(),
          hash_contrasena: hash,
          tipo_usuario: TipoUsuario.GRUPERO,
          activo: true,
        }),
      );
      return gestor.getRepository(Grupero).save(
        gestor.getRepository(Grupero).create({
          pk_grupero: randomUUID(),
          fk_usuario: usuario.pk_usuario,
          fk_banquero: alcance.fk_banquero,
          cupo_animal: (datos.cupo_animal ?? 500).toFixed(2),
          comision_porcentaje: (datos.comision_porcentaje ?? 3).toFixed(3),
          activo: true,
          fk_usuario_modificado: sesion.sub,
        }),
      );
    });
    return { mensaje: 'Grupero creado correctamente.', pk_grupero: creado.pk_grupero };
  }

  private async gruperoEnAlcance(alcance: Alcance, pkGrupero: string): Promise<Grupero> {
    if (!alcance.es_banquero) throw new ForbiddenException('Solo el Banquero administra gruperos.');
    const grupero = await this.gruperos.findOneBy({ pk_grupero: pkGrupero, fk_banquero: alcance.fk_banquero });
    if (!grupero) throw new ForbiddenException('El grupero no pertenece a tu operación.');
    return grupero;
  }

  async actualizarGrupero(sesion: Sesion, pkGrupero: string, datos: ActualizarGruperoDto) {
    const alcance = await this.alcance(sesion);
    const grupero = await this.gruperoEnAlcance(alcance, pkGrupero);
    await this.gruperos.manager.transaction(async (gestor) => {
      await gestor.getRepository(Grupero).update(grupero.pk_grupero, {
        ...(datos.cupo_animal !== undefined ? { cupo_animal: datos.cupo_animal.toFixed(2) } : {}),
        ...(datos.comision_porcentaje !== undefined ? { comision_porcentaje: datos.comision_porcentaje.toFixed(3) } : {}),
        ...(datos.activo !== undefined ? { activo: datos.activo } : {}),
        fk_usuario_modificado: sesion.sub,
      });
      if (datos.nombre_completo !== undefined) {
        await gestor.getRepository(Usuario).update(grupero.fk_usuario, { nombre_completo: datos.nombre_completo.trim() });
      }
    });
    return { mensaje: 'Grupero actualizado correctamente.' };
  }

  async desactivarGrupero(sesion: Sesion, pkGrupero: string) {
    const alcance = await this.alcance(sesion);
    const grupero = await this.gruperoEnAlcance(alcance, pkGrupero);
    const activas = await this.agencias.count({ where: { fk_grupero: grupero.pk_grupero, activa: true } });
    if (activas > 0) {
      throw new BadRequestException(
        `El grupero todavía tiene ${activas} agencia(s) activa(s). Reasígnalas o desactívalas antes de desactivarlo.`,
      );
    }
    await this.gruperos.manager.transaction(async (gestor) => {
      await gestor.getRepository(Grupero).update(grupero.pk_grupero, { activo: false, fk_usuario_modificado: sesion.sub });
      await gestor.getRepository(Usuario).update(grupero.fk_usuario, { activo: false });
    });
    return { mensaje: 'Grupero desactivado. Su historial se conserva.' };
  }

  /** Equipos y usuarios bloqueados por intentos fallidos dentro del alcance del operador. */
  async listarAccesos(sesion: Sesion) {
    const alcance = await this.alcance(sesion);
    const agencias = await this.agencias.find({ where: this.filtroAgencias(alcance), relations: { usuario: true } });
    const gruperos = alcance.es_banquero
      ? await this.gruperos.find({ where: { fk_banquero: alcance.fk_banquero }, relations: { usuario: true } })
      : await this.gruperos.find({ where: { pk_grupero: alcance.fk_grupero! }, relations: { usuario: true } });
    const usuarios = [...agencias.map((agencia) => agencia.usuario.nombre_usuario), ...gruperos.map((grupero) => grupero.usuario.nombre_usuario)];
    const equipos = agencias.map((agencia) => agencia.serial_pc).filter((serial): serial is string => Boolean(serial));
    const bloqueos = await this.controlAcceso.listarBloqueados({ usuarios, equipos });
    const ahora = Date.now();
    return bloqueos
      .map((bloqueo) => ({
        pk_control_acceso: bloqueo.pk_control_acceso,
        tipo: bloqueo.tipo,
        clave: bloqueo.clave,
        bloqueado_hasta: bloqueo.bloqueado_hasta,
        permanente: bloqueo.bloqueo_permanente,
        vigente: Boolean(bloqueo.bloqueo_permanente || (bloqueo.bloqueado_hasta && bloqueo.bloqueado_hasta.getTime() > ahora)),
        bloqueos_consecutivos: bloqueo.bloqueos_consecutivos,
        ultimo_intento_at: bloqueo.ultimo_intento_at,
      }));
  }

  async desbloquearAcceso(sesion: Sesion, pkControlAcceso: string) {
    const alcanceAccesos = await this.listarAccesos(sesion);
    if (!alcanceAccesos.some((bloqueo) => bloqueo.pk_control_acceso === pkControlAcceso)) {
      throw new ForbiddenException('Ese bloqueo no pertenece a tu operación.');
    }
    const liberado = await this.controlAcceso.desbloquear(pkControlAcceso);
    if (!liberado) throw new BadRequestException('El bloqueo ya no existe.');
    return { mensaje: 'Acceso liberado. El equipo o usuario puede volver a intentarlo.' };
  }
}
