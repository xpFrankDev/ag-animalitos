import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Agencia } from './agencia.entity';
import { EstadoTicket } from './estados';
import { JugadaTicket } from './jugada-ticket.entity';

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
