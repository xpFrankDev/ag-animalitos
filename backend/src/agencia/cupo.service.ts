import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Agencia, EstadoJugada, JugadaTicket } from '../base-datos/entidades';

/** Una jugada premiada o pagada sigue ocupando cupo: ya fue vendida y es válida. */
export const ESTADOS_QUE_OCUPAN_CUPO = [EstadoJugada.ACTIVA, EstadoJugada.PREMIADA, EstadoJugada.PAGADA];

export type OrigenCupo = 'AGENCIA' | 'GRUPERO';

export type JugadaCupo = { fk_animal: number; fk_horario_sorteo: number; monto: number };

export type EvaluacionCupo = {
  fk_animal: number;
  fk_horario_sorteo: number;
  monto: number;
  vendido_agencia: number;
  disponible_agencia: number;
  vendido_grupero: number | null;
  disponible_grupero: number | null;
  excedido: OrigenCupo | null;
};

export function claveCupo(fkAnimal: number, fkHorarioSorteo: number): string {
  return `${fkAnimal}-${fkHorarioSorteo}`;
}

/** Redondeo defensivo: los cupos son dinero y no deben arrastrar decimales binarios. */
function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class CupoService {
  constructor(@InjectRepository(JugadaTicket) private readonly jugadas: Repository<JugadaTicket>) {}

  /**
   * Suma el cupo consumido de todas las combinaciones del ticket en una sola consulta,
   * en lugar de consultar una vez por jugada.
   */
  async consumosPorCombinacion(
    gestor: EntityManager,
    fechaJuego: string,
    idsAgencias: string[],
    jugadas: JugadaCupo[],
  ): Promise<Map<string, number>> {
    if (!idsAgencias.length || !jugadas.length) return new Map();
    const animales = [...new Set(jugadas.map((jugada) => jugada.fk_animal))];
    const horarios = [...new Set(jugadas.map((jugada) => jugada.fk_horario_sorteo))];
    const filas = await gestor
      .getRepository(JugadaTicket)
      .createQueryBuilder('jugada')
      .innerJoin('jugada.ticket', 'ticket')
      .select('jugada.fk_animal', 'fk_animal')
      .addSelect('jugada.fk_horario_sorteo', 'fk_horario_sorteo')
      .addSelect('COALESCE(SUM(jugada.monto), 0)', 'total')
      .where('jugada.fecha_juego = :fechaJuego', { fechaJuego })
      .andWhere('jugada.fk_animal IN (:...animales)', { animales })
      .andWhere('jugada.fk_horario_sorteo IN (:...horarios)', { horarios })
      .andWhere('jugada.estado IN (:...estados)', { estados: ESTADOS_QUE_OCUPAN_CUPO })
      .andWhere('ticket.fk_agencia IN (:...idsAgencias)', { idsAgencias })
      .groupBy('jugada.fk_animal')
      .addGroupBy('jugada.fk_horario_sorteo')
      .getRawMany<{ fk_animal: string; fk_horario_sorteo: string; total: string }>();
    return new Map(
      filas.map((fila) => [claveCupo(Number(fila.fk_animal), Number(fila.fk_horario_sorteo)), Number(fila.total)]),
    );
  }

  /**
   * Evalúa el cupo de agencia y, cuando corresponde, el cupo compartido del grupero.
   * Devuelve el detalle por combinación para que la taquilla pueda mostrarlo antes de imprimir.
   */
  async evaluar(
    gestor: EntityManager,
    parametros: {
      fechaJuego: string;
      jugadas: JugadaCupo[];
      agencia: Agencia;
      grupo?: { cupo: number; idsAgencias: string[] } | null;
    },
  ): Promise<EvaluacionCupo[]> {
    const { fechaJuego, jugadas, agencia, grupo } = parametros;
    const cupoAgencia = Number(agencia.cupo_animal);
    const [consumoAgencia, consumoGrupo] = await Promise.all([
      this.consumosPorCombinacion(gestor, fechaJuego, [agencia.pk_agencia], jugadas),
      grupo ? this.consumosPorCombinacion(gestor, fechaJuego, grupo.idsAgencias, jugadas) : Promise.resolve(new Map<string, number>()),
    ]);

    return jugadas.map((jugada) => {
      const clave = claveCupo(jugada.fk_animal, jugada.fk_horario_sorteo);
      const vendidoAgencia = consumoAgencia.get(clave) ?? 0;
      const vendidoGrupo = grupo ? consumoGrupo.get(clave) ?? 0 : null;
      const disponibleAgencia = redondear(Math.max(0, cupoAgencia - vendidoAgencia - jugada.monto));
      const disponibleGrupero = grupo ? redondear(Math.max(0, grupo.cupo - (vendidoGrupo ?? 0) - jugada.monto)) : null;
      let excedido: OrigenCupo | null = null;
      if (redondear(vendidoAgencia + jugada.monto) > cupoAgencia) excedido = 'AGENCIA';
      else if (grupo && redondear((vendidoGrupo ?? 0) + jugada.monto) > grupo.cupo) excedido = 'GRUPERO';
      return {
        fk_animal: jugada.fk_animal,
        fk_horario_sorteo: jugada.fk_horario_sorteo,
        monto: jugada.monto,
        vendido_agencia: redondear(vendidoAgencia),
        disponible_agencia: disponibleAgencia,
        vendido_grupero: vendidoGrupo === null ? null : redondear(vendidoGrupo),
        disponible_grupero: disponibleGrupero,
        excedido,
      };
    });
  }

  async validar(
    gestor: EntityManager,
    parametros: {
      fechaJuego: string;
      jugadas: JugadaCupo[];
      agencia: Agencia;
      grupo?: { cupo: number; idsAgencias: string[] } | null;
    },
  ): Promise<EvaluacionCupo[]> {
    const evaluacion = await this.evaluar(gestor, parametros);
    const excedida = evaluacion.find((item) => item.excedido);
    if (!excedida) return evaluacion;
    const disponible = excedida.excedido === 'AGENCIA' ? excedida.disponible_agencia : excedida.disponible_grupero;
    throw new BadRequestException(
      `Cupo de ${excedida.excedido === 'AGENCIA' ? 'Agencia' : 'Grupero'} agotado para una de las combinaciones. Disponible: ${Number(disponible ?? 0).toFixed(2)}.`,
    );
  }
}
