import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TipoControlAcceso } from './estados';

/**
 * Control de intentos fallidos por usuario, IP y equipo. Vive en base de datos para
 * sobrevivir reinicios y ser consistente entre instancias de la API.
 */
@Entity('control_acceso')
@Index(['tipo', 'clave'], { unique: true })
export class ControlAcceso {
  @PrimaryGeneratedColumn('uuid')
  pk_control_acceso!: string;

  @Column({ type: 'enum', enum: TipoControlAcceso })
  tipo!: TipoControlAcceso;

  @Column({ type: 'varchar', length: 120 })
  clave!: string;

  @Column({ type: 'smallint', default: 0 })
  intentos_fallidos!: number;

  /** Cantidad de veces que este alcance ya fue bloqueado; a la tercera el bloqueo es permanente. */
  @Column({ type: 'smallint', default: 0 })
  bloqueos_consecutivos!: number;

  @Column({ type: 'datetime', nullable: true })
  bloqueado_hasta!: Date | null;

  /** Bloqueo sin vencimiento: solo lo libera el grupero o el banquero dueño del alcance. */
  @Column({ type: 'boolean', default: false })
  bloqueo_permanente!: boolean;

  @Column({ type: 'datetime', nullable: true })
  ultimo_intento_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  ultimo_bloqueo_at!: Date | null;

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}
