import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum TipoUsuario {
  AGENCIA = 'AGENCIA',
  GRUPERO = 'GRUPERO',
  BANQUERO = 'BANQUERO',
}

export enum EstadoTicket {
  ACTIVO = 'ACTIVO',
  CANCELADO = 'CANCELADO',
  PREMIADO = 'PREMIADO',
  PAGADO = 'PAGADO',
}

export enum EstadoJugada {
  ACTIVA = 'ACTIVA',
  CANCELADA = 'CANCELADA',
  PREMIADA = 'PREMIADA',
  PAGADA = 'PAGADA',
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  pk_usuario!: string;

  @Index({ unique: true })
  @Column({ length: 50 })
  nombre_usuario!: string;

  @Column({ length: 120 })
  nombre_completo!: string;

  @Column({ length: 255, select: false })
  hash_contrasena!: string;

  @Column({ type: 'enum', enum: TipoUsuario })
  tipo_usuario!: TipoUsuario;

  @Column({ default: true })
  activo!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  creado_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}

@Entity('agencias')
export class Agencia {
  @PrimaryGeneratedColumn('uuid')
  pk_agencia!: string;

  @Index({ unique: true })
  @Column({ length: 20 })
  codigo_agencia!: string;

  @Column({ length: 120 })
  nombre_agencia!: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 12 })
  comision_porcentaje!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 100 })
  cupo_animal!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 1 })
  jugada_minima!: string;

  @Column({ type: 'smallint', default: 5 })
  minutos_cierre!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serial_pc!: string | null;

  @Column({ default: 1 })
  proximo_numero_ticket!: number;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'fk_usuario' })
  usuario!: Usuario;

  @Column()
  fk_usuario!: string;

  @Column()
  fk_banquero!: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'fk_banquero' })
  banquero!: Usuario;

  @ManyToOne(() => Grupero, { nullable: true })
  @JoinColumn({ name: 'fk_grupero' })
  grupero!: Grupero | null;

  @Column({ nullable: true })
  fk_grupero!: string | null;

  @Column({ default: true })
  activa!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  creado_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column({ nullable: true })
  fk_usuario_modificado!: string | null;
}

@Entity('gruperos')
export class Grupero {
  @PrimaryGeneratedColumn('uuid')
  pk_grupero!: string;

  @Index({ unique: true })
  @Column()
  fk_usuario!: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'fk_usuario' })
  usuario!: Usuario;

  @Column()
  fk_banquero!: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'fk_banquero' })
  banquero!: Usuario;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 500 })
  cupo_animal!: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 3 })
  comision_porcentaje!: string;

  @Column({ default: true })
  activo!: boolean;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column({ nullable: true })
  fk_usuario_modificado!: string | null;
}

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

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  pk_ticket!: string;

  @Index({ unique: true })
  @Column({ length: 24 })
  serial!: string;

  @Index(['fk_agencia', 'numero_ticket', 'fecha_juego'], { unique: true })
  @Column({ type: 'int' })
  numero_ticket!: number;

  @Column({ type: 'date' })
  fecha_juego!: string;

  @Column()
  fk_agencia!: string;

  @ManyToOne(() => Agencia, { nullable: false })
  @JoinColumn({ name: 'fk_agencia' })
  agencia!: Agencia;

  @Column({ type: 'enum', enum: EstadoTicket, default: EstadoTicket.ACTIVO })
  estado!: EstadoTicket;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_jugado!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_premio!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  monto_pagado!: string;

  @CreateDateColumn({ type: 'datetime' })
  creado_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column()
  fk_usuario_modificado!: string;

  @OneToMany(() => JugadaTicket, (jugada) => jugada.ticket)
  jugadas!: JugadaTicket[];
}

@Entity('jugadas_ticket')
@Index(['fecha_juego', 'fk_horario_sorteo', 'fk_animal'])
export class JugadaTicket {
  @PrimaryGeneratedColumn('uuid')
  pk_jugada_ticket!: string;

  @Column()
  fk_ticket!: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.jugadas, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'fk_ticket' })
  ticket!: Ticket;

  @Column()
  fk_animal!: number;

  @ManyToOne(() => Animal, { nullable: false })
  @JoinColumn({ name: 'fk_animal' })
  animal!: Animal;

  @Column()
  fk_horario_sorteo!: number;

  @ManyToOne(() => HorarioSorteo, { nullable: false })
  @JoinColumn({ name: 'fk_horario_sorteo' })
  horario_sorteo!: HorarioSorteo;

  @Column({ type: 'date' })
  fecha_juego!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  monto!: string;

  @Column({ type: 'enum', enum: EstadoJugada, default: EstadoJugada.ACTIVA })
  estado!: EstadoJugada;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column()
  fk_usuario_modificado!: string;
}

@Entity('resultados')
@Index(['fecha_juego', 'fk_horario_sorteo'], { unique: true })
export class Resultado {
  @PrimaryGeneratedColumn('uuid')
  pk_resultado!: string;

  @Column({ type: 'date' })
  fecha_juego!: string;

  @Column()
  fk_horario_sorteo!: number;

  @Column()
  fk_animal!: number;

  @Column({ type: 'datetime' })
  insertado_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column()
  fk_usuario_modificado!: string;
}

export const entidades = [Usuario, Grupero, Agencia, Animal, Sorteo, HorarioSorteo, Ticket, JugadaTicket, Resultado];
