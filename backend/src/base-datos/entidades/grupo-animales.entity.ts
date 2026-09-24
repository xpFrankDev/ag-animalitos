import { Column, Entity, Index, JoinTable, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Animal } from './animal.entity';

/**
 * Lista de animales que comparten uno o más sorteos. La taquilla dibuja exactamente los
 * animales del grupo del sorteo elegido, por eso un ticket no puede mezclar listas:
 * los sorteos clásicos (00, 0 y 1 a 36) y Guácharo Activo (00, 0 y 1 a 75) son grupos
 * distintos aunque compartan horarios.
 */
@Entity('grupos_animales')
export class GrupoAnimales {
  @PrimaryGeneratedColumn('increment')
  pk_grupo_animales!: number;

  @Index({ unique: true })
  @Column({ length: 50 })
  nombre!: string;

  @Column({ default: true })
  activo!: boolean;

  @ManyToMany(() => Animal)
  @JoinTable({
    name: 'grupos_animales_animales',
    joinColumn: { name: 'fk_grupo_animales', referencedColumnName: 'pk_grupo_animales' },
    inverseJoinColumn: { name: 'fk_animal', referencedColumnName: 'pk_animal' },
  })
  animales!: Animal[];

  @UpdateDateColumn({ type: 'datetime' })
  modificado_at!: Date;
}
