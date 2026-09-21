import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrigenResultado } from './estados';

/**
 * Un resultado pertenece al sorteo y al horario, no a un banquero: la fuente es pública
 * y todos los banqueros operan los mismos sorteos. La unicidad es por día y horario.
 */
@Entity('resultados')
@Index(['fecha_juego', 'fk_horario_sorteo'], { unique: true })
export class Resultado {
  @PrimaryGeneratedColumn('uuid')
  pk_resultado!: string;

  @Column({ type: 'date' })
  fecha_juego!: string;

  @Column()
  fk_horario_sorteo!: number;

  @Column()
  fk_animal!: number;

  @Column({ type: 'enum', enum: OrigenResultado, default: OrigenResultado.AUTOMATICO })
  origen!: OrigenResultado;

  @Column({ type: 'datetime' })
  insertado_at!: Date;

  /** Marca cuándo se aplicó a los tickets; el proceso de calificación toma los pendientes. */
  @Column({ type: 'datetime', nullable: true })
  aplicado_at!: Date | null;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column({ type: 'varchar', length: 36, nullable: true })
  fk_usuario_modificado!: string | null;
}
