import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('resultados')
@Index(['fecha_juego', 'fk_horario_sorteo', 'fk_banquero'], { unique: true })
export class Resultado {
  @PrimaryColumn({ type: 'char', length: 36 })
  pk_resultado!: string;

  @Column({ type: 'date' })
  fecha_juego!: string;

  @Column({ type: 'int' })
  fk_horario_sorteo!: number;

  @Column({ type: 'int' })
  fk_animal!: number;

  @Column({ type: 'varchar', length: 36 })
  fk_banquero!: string;

  @Column({ type: 'datetime' })
  insertado_at!: Date;

  @Column({ type: 'varchar', length: 36 })
  fk_usuario_modificado!: string;
}
