# Criterios visuales de Animalitos

- Mantén una consola operativa clara con paleta blanco/naranja, estados con colores semánticos y contrastes accesibles.
- Los avisos de acción, éxito, advertencia y error se muestran como notificaciones flotantes temporales; nunca deben quedar acoplados al final de un panel ni permanecer sin una razón explícita.
- Las listas y tablas usan una altura máxima adaptada al viewport con scroll interno. Un único resultado no debe estirar su contenedor hasta ocupar el alto disponible.
- Las jugadas y los tickets se ordenan cronológicamente por hora de sorteo, tanto en pantalla como en cualquier representación de impresión o vista previa.
- Todo control nuevo debe tener estados de foco, vacío, error, carga y confirmación visibles. Prefiere jerarquía, iconografía o ilustración útil y espaciado deliberado antes que bloques visuales genéricos.

# Persistencia técnica

## TypeORM y MariaDB

Al definir columnas opcionales en entidades TypeORM, no uses `@Column({ nullable: true })` junto con propiedades TypeScript del tipo `string | null`. El diseño de metadatos puede inferir `Object`, que MariaDB rechaza. Declara siempre el tipo de base de datos explícitamente, por ejemplo `@Column({ type: 'varchar', length: 36, nullable: true })` para UUID opcional y `@Column({ type: 'varchar', length: 100, nullable: true })` para texto opcional.

No declares a relación `@ManyToOne` con `@JoinColumn({ name: 'fk_x' })` y una propiedad `@Column` separada con el mismo `fk_x`: TypeORM crea metadatos de columna duplicados e incompatibles. Conserva solo la columna escalar si el código consulta la clave directamente; si se necesita navegación de relación, modela una única relación y no repitas la columna.

# Flujo de trabajo y despliegue

- Trabajar y verificar todos los cambios en local primero. No modificar el VPS ni hacer despliegues durante el desarrollo; verificar en local no requiere confirmación, pero cualquier cambio en el VPS sí.
- Acumular los cambios confirmados por el usuario y realizar un único despliegue al VPS solo después de una confirmación explícita.
- Antes de ese despliegue final, revisar configuración, migraciones, secretos exclusivos de producción y una lista breve de verificación/reversión.
- Nunca copiar credenciales locales al VPS ni versionar archivos `.env`.
