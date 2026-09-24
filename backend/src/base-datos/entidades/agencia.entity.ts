import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

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

  /** Saltos de línea en blanco al final de la tirilla; 0 imprime sin espacio adicional. */
  @Column({ type: 'smallint', default: 0 })
  salto_linea!: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  serial_pc!: string | null;

  @Column({ default: 1 })
  proximo_numero_ticket!: number;

  /** Jornada a la que corresponde `proximo_numero_ticket`; si cambia el día, vuelve a 1. */
  @Column({ type: 'date', nullable: true })
  fecha_numero_ticket!: string | null;

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

  @Column({ type: 'varchar', length: 36, nullable: true })
  fk_grupero!: string | null;

  @Column({ default: true })
  activa!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  creado_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;

  @Column({ type: 'varchar', length: 36, nullable: true })
  fk_usuario_modificado!: string | null;
}
