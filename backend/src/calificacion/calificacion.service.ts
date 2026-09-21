import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { EstadoJugada, EstadoTicket, JugadaTicket, Resultado, Ticket } from '../base-datos/entidades';

export type ResumenCalificacion = { resultados: number; jugadas: number; tickets: number };

/**
 * Convierte resultados en estados de ticket. Se ejecuta en segundo plano y es idempotente:
 * cada resultado se aplica una sola vez (`aplicado_at`) y recalcula los estados del horario,
 * de modo que una corrección de resultado vuelve a dejar los tickets en el estado correcto.
 */
@Injectable()
export class CalificacionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalificacionService.name);
  private temporizador?: NodeJS.Timeout;
  private enEjecucion = false;

  constructor(
    private readonly origenDatos: DataSource,
    @InjectRepository(Resultado) private readonly resultados: Repository<Resultado>,
  ) {}

  onModuleInit(): void {
    if (process.env.CALIFICACION_ACTIVA === 'false') return;
    const intervalo = Math.max(15_000, Number(process.env.CALIFICACION_INTERVALO_MS ?? 60_000));
    this.temporizador = setInterval(() => void this.aplicarPendientes(), intervalo);
    void this.aplicarPendientes();
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  async aplicarPendientes(): Promise<ResumenCalificacion> {
    if (this.enEjecucion) return { resultados: 0, jugadas: 0, tickets: 0 };
    this.enEjecucion = true;
    try {
      const pendientes = await this.resultados.find({
        where: { aplicado_at: IsNull() },
        order: { fecha_juego: 'ASC' },
        take: 50,
      });
      const resumen: ResumenCalificacion = { resultados: 0, jugadas: 0, tickets: 0 };
      for (const resultado of pendientes) {
        const parcial = await this.aplicarResultado(resultado);
        resumen.resultados += 1;
        resumen.jugadas += parcial.jugadas;
        resumen.tickets += parcial.tickets;
      }
      if (resumen.resultados) {
        this.logger.log(`Calificación aplicada: ${resumen.resultados} resultado(s), ${resumen.jugadas} jugada(s), ${resumen.tickets} ticket(s).`);
      }
      return resumen;
    } finally {
      this.enEjecucion = false;
    }
  }

  private async aplicarResultado(resultado: Resultado): Promise<{ jugadas: number; tickets: number }> {
    return this.origenDatos.transaction(async (gestor) => {
      const repositorioJugadas = gestor.getRepository(JugadaTicket);
      const repositorioTickets = gestor.getRepository(Ticket);

      // Tickets que participan en el horario: se recalculan todos para admitir correcciones.
      const jugadasDelHorario = await repositorioJugadas.find({
        where: { fecha_juego: resultado.fecha_juego, fk_horario_sorteo: resultado.fk_horario_sorteo },
        relations: { ticket: true },
      });
      const ticketsInvolucrados = [...new Set(jugadasDelHorario.map((jugada) => jugada.ticket.pk_ticket))];

      const aRevertir = jugadasDelHorario.filter(
        (jugada) => jugada.estado === EstadoJugada.PREMIADA && jugada.ticket.estado !== EstadoTicket.PAGADO,
      );
      if (aRevertir.length) {
        await repositorioJugadas.update(
          { pk_jugada_ticket: In(aRevertir.map((jugada) => jugada.pk_jugada_ticket)) },
          { estado: EstadoJugada.ACTIVA, fk_usuario_modificado: null },
        );
      }

      const ganadoras = jugadasDelHorario.filter(
        (jugada) => jugada.fk_animal === resultado.fk_animal && jugada.estado === EstadoJugada.ACTIVA,
      );
      if (ganadoras.length) {
        await repositorioJugadas.update(
          { pk_jugada_ticket: In(ganadoras.map((jugada) => jugada.pk_jugada_ticket)) },
          { estado: EstadoJugada.PREMIADA, fk_usuario_modificado: null },
        );
      }

      let ticketsActualizados = 0;
      for (const pkTicket of ticketsInvolucrados) {
        const ticket = jugadasDelHorario.find((jugada) => jugada.ticket.pk_ticket === pkTicket)!.ticket;
        if (ticket.estado === EstadoTicket.PAGADO || ticket.estado === EstadoTicket.CANCELADO) continue;
        const premiadas = await repositorioJugadas.count({ where: { fk_ticket: pkTicket, estado: EstadoJugada.PREMIADA } });
        const estadoEsperado = premiadas > 0 ? EstadoTicket.PREMIADO : EstadoTicket.ACTIVO;
        if (ticket.estado !== estadoEsperado) {
          await repositorioTickets.update(pkTicket, { estado: estadoEsperado, fk_usuario_modificado: null });
          ticketsActualizados += 1;
        }
      }

      await this.resultados.update(resultado.pk_resultado, { aplicado_at: new Date() });
      return { jugadas: ganadoras.length + aRevertir.length, tickets: ticketsActualizados };
    });
  }

  /** Endpoint interno de observación: cuántos resultados quedan sin aplicar. */
  async estado(): Promise<{ pendientes: number; en_ejecucion: boolean }> {
    const pendientes = await this.resultados.count({ where: { aplicado_at: IsNull() } });
    return { pendientes, en_ejecucion: this.enEjecucion };
  }
}
