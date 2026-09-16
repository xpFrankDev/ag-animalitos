import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('resultados')
@Index(['fecha_juego', 'fk_horario_sorteo', 'fk_banquero'], { unique: true })
export class Resultado {
  @PrimaryGeneratedColumn('uuid')
  pk_resultado!: string;

  @Column({ type: 'date' })
  fecha_juego!: string;

  @Column()
  fk_horario_sorteo!: number;

  @Column()
  fk_animal!: number;

  @Column({ type: 'varchar', length: 36 })
  fk_banquero!: string;

  @Column({ type: 'datetime' })
  insertado_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column()
  fk_usuario_modificado!: string;
}
