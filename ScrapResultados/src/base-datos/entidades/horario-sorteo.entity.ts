import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('horarios_sorteo')
@Index(['fk_sorteo', 'hora'], { unique: true })
export class HorarioSorteo {
  @PrimaryGeneratedColumn('increment')
  pk_horario_sorteo!: number;

  @Column({ type: 'int' })
  fk_sorteo!: number;

  @Column({ type: 'time' })
  hora!: string;

  @Column({ type: 'boolean' })
  activo!: boolean;
}
