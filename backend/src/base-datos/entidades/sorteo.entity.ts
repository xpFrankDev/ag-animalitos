import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('sorteos')
export class Sorteo {
  @PrimaryGeneratedColumn('increment')
  pk_sorteo!: number;

  @Index({ unique: true })
  @Column({ length: 50 })
  nombre!: string;

  @Column({ default: true })
  activo!: boolean;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}
