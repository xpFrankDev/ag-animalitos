import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Animal } from './animal.entity';
import { EstadoJugada } from './estados';
import { HorarioSorteo } from './horario-sorteo.entity';
import { Ticket } from './ticket.entity';

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
