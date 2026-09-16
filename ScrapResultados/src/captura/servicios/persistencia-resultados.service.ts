import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Animal, HorarioSorteo, Resultado, Sorteo } from '../../base-datos/entidades';
import { ResultadoExtraido } from '../tipos';

@Injectable()
export class PersistenciaResultadosService {
  private readonly logger = new Logger(PersistenciaResultadosService.name);

  constructor(
    @InjectRepository(Animal) private readonly animales: Repository<Animal>,
    @InjectRepository(Sorteo) private readonly sorteos: Repository<Sorteo>,
    @InjectRepository(HorarioSorteo) private readonly horarios: Repository<HorarioSorteo>,
    @InjectRepository(Resultado) private readonly resultados: Repository<Resultado>,
  ) {}

  async guardarNuevos(resultado: ResultadoExtraido): Promise<'insertado' | 'existente'> {
    const banquero = process.env.FK_BANQUERO;
    if (!banquero) throw new Error('Falta configurar FK_BANQUERO.');
    const [animal, sorteo] = await Promise.all([
      this.animales.findOneBy({ codigo_animal: resultado.codigo_animal, activo: true }),
      this.sorteos.findOneBy({ nombre: resultado.programa, activo: true }),
    ]);
    if (!animal) throw new Error(`No existe un animal activo con código ${resultado.codigo_animal}.`);
    if (!sorteo) throw new Error(`No existe un sorteo activo llamado «${resultado.programa}».`);
    const horario = await this.horarios.findOneBy({ fk_sorteo: sorteo.pk_sorteo, hora: resultado.hora, activo: true });
    if (!horario) throw new Error(`No existe el horario ${resultado.hora} para ${resultado.programa}.`);

    const insercion = await this.resultados.createQueryBuilder().insert().into(Resultado).values({
      pk_resultado: randomUUID(), fecha_juego: resultado.fecha_juego, fk_horario_sorteo: horario.pk_horario_sorteo,
      fk_animal: animal.pk_animal, fk_banquero: banquero, insertado_at: new Date(), fk_usuario_modificado: banquero,
    }).orIgnore().execute();
    if (insercion.identifiers.length) {
      this.logger.log(`${resultado.programa} ${resultado.fecha_juego} ${resultado.hora}: animal ${resultado.codigo_animal} insertado.`);
      return 'insertado';
    }
    return 'existente';
  }
}
