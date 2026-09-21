#!/bin/sh
set -eu

mysql -uroot -p"${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${MARIADB_MIGRACIONES_USUARIO}'@'%' IDENTIFIED BY '${MARIADB_MIGRACIONES_CONTRASENA}';
GRANT ALTER, CREATE, DROP, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE ON \`${MARIADB_DATABASE}\`.* TO '${MARIADB_MIGRACIONES_USUARIO}'@'%';

-- Recolector de resultados: solo lectura del catálogo y escritura de resultados nuevos.
-- Los permisos por tabla se aplican después de las migraciones (permisos-recolector):
-- en este punto las tablas todavía no existen y MariaDB rechaza el GRANT.
CREATE USER IF NOT EXISTS '${MARIADB_SCRAP_USUARIO}'@'%' IDENTIFIED BY '${MARIADB_SCRAP_CONTRASENA}';
FLUSH PRIVILEGES;
SQL
