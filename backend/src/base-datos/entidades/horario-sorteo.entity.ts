import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Sorteo } from './sorteo.entity';

@Entity('horarios_sorteo')
@Index(['fk_sorteo', 'hora'], { unique: true })
export class HorarioSorteo {
  @PrimaryGeneratedColumn('increment')
  pk_horario_sorteo!: number;

  @Column()
  fk_sorteo!: number;

  @ManyToOne(() => Sorteo, { nullable: false })
  @JoinColumn({ name: 'fk_sorteo' })
  sorteo!: Sorteo;

  @Column({ type: 'time' })
  hora!: string;

  @Column({ default: true })
  activo!: boolean;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}
