import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

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

  @Column({ type: 'varchar', length: 36, nullable: true })
  fk_usuario_modificado!: string | null;
}
