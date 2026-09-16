import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('animales')
export class Animal {
  @PrimaryGeneratedColumn('increment')
  pk_animal!: number;

  @Index({ unique: true })
  @Column({ length: 2 })
  codigo_animal!: string;

  @Column({ length: 60 })
  nombre!: string;

  @Column({ length: 8 })
  icono!: string;

  @Column({ default: true })
  activo!: boolean;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}
