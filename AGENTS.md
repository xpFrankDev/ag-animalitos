# Persistencia técnica

## TypeORM y MariaDB

Al definir columnas opcionales en entidades TypeORM, no uses `@Column({ nullable: true })` junto con propiedades TypeScript del tipo `string | null`. El diseño de metadatos puede inferir `Object`, que MariaDB rechaza. Declara siempre el tipo de base de datos explícitamente, por ejemplo `@Column({ type: 'varchar', length: 36, nullable: true })` para UUID opcional y `@Column({ type: 'varchar', length: 100, nullable: true })` para texto opcional.

No declares a relación `@ManyToOne` con `@JoinColumn({ name: 'fk_x' })` y una propiedad `@Column` separada con el mismo `fk_x`: TypeORM crea metadatos de columna duplicados e incompatibles. Conserva solo la columna escalar si el código consulta la clave directamente; si se necesita navegación de relación, modela una única relación y no repitas la columna.
