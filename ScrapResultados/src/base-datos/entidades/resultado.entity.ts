import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Los resultados son globales: pertenecen al sorteo y al horario, no a un banquero.
 * Este servicio solo inserta; la calificación de tickets la ejecuta la API principal.
 */
@Entity('resultados')
@Index(['fecha_juego', 'fk_horario_sorteo'], { unique: true })
export class Resultado {
  @PrimaryColumn({ type: 'char', length: 36 })
  pk_resultado!: string;

  @Column({ type: 'date' })
  fecha_juego!: string;

  @Column({ type: 'int' })
  fk_horario_sorteo!: number;

  @Column({ type: 'int' })
  fk_animal!: number;

  @Column({ type: 'enum', enum: ['AUTOMATICO', 'MANUAL'], default: 'AUTOMATICO' })
  origen!: 'AUTOMATICO' | 'MANUAL';

  @Column({ type: 'datetime' })
  insertado_at!: Date;

  @Column({ type: 'datetime', nullable: true })
  aplicado_at!: Date | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  fk_usuario_modificado!: string | null;
}
