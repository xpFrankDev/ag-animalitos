import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sorteos')
export class Sorteo {
  @PrimaryGeneratedColumn('increment')
  pk_sorteo!: number;

  @Index({ unique: true })
  @Column({ length: 50 })
  nombre!: string;

  /** Multiplicador de premio propio de cada sorteo. Los sorteos existentes parten de 30. */
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 30 })
  multiplicador_premio!: string;

  @Column({ default: true })
  activo!: boolean;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}
