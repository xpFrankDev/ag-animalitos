import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TipoUsuario } from './estados';

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
