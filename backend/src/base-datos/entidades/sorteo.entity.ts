import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { GrupoAnimales } from './grupo-animales.entity';

@Entity('sorteos')
export class Sorteo {
  @PrimaryGeneratedColumn('increment')
  pk_sorteo!: number;

  @Index({ unique: true })
  @Column({ length: 50 })
  nombre!: string;

  /** Lista de animales que participan en este sorteo; dos sorteos pueden compartirla. */
  @ManyToOne(() => GrupoAnimales, { nullable: false })
  @JoinColumn({ name: 'fk_grupo_animales' })
  grupo_animales!: GrupoAnimales;

  /** Multiplicador de premio propio de cada sorteo: 30 en los clásicos y 60 en Guácharo Activo. */
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 30 })
  multiplicador_premio!: string;

  @Column({ default: true })
  activo!: boolean;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}
