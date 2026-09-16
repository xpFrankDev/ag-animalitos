import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('animales')
export class Animal {
  @PrimaryGeneratedColumn('increment')
  pk_animal!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 2 })
  codigo_animal!: string;

  @Column({ type: 'boolean' })
  activo!: boolean;
}
