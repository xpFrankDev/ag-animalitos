import { Column, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

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

export const entidades = [Animal, Sorteo, HorarioSorteo, Resultado];
