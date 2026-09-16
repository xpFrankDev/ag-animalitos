import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('sorteos')
export class Sorteo {
  @PrimaryGeneratedColumn('increment')
  pk_sorteo!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  nombre!: string;

  @Column({ type: 'boolean' })
  activo!: boolean;
}
