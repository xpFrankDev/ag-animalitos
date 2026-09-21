#!/bin/sh
# Permisos mínimos del recolector de resultados.
#
# Se ejecuta como servicio de una sola vez, después de las migraciones, porque MariaDB
# no permite otorgar privilegios sobre tablas que todavía no existen.
set -eu

mariadb --host="${DB_HOST:-mariadb}" --user=root --password="${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${MARIADB_SCRAP_USUARIO}'@'%' IDENTIFIED BY '${MARIADB_SCRAP_CONTRASENA}';
GRANT SELECT ON \`${MARIADB_DATABASE}\`.animales TO '${MARIADB_SCRAP_USUARIO}'@'%';
GRANT SELECT ON \`${MARIADB_DATABASE}\`.sorteos TO '${MARIADB_SCRAP_USUARIO}'@'%';
GRANT SELECT ON \`${MARIADB_DATABASE}\`.horarios_sorteo TO '${MARIADB_SCRAP_USUARIO}'@'%';
GRANT SELECT, INSERT ON \`${MARIADB_DATABASE}\`.resultados TO '${MARIADB_SCRAP_USUARIO}'@'%';
FLUSH PRIVILEGES;
SQL

echo 'Permisos del recolector de resultados aplicados.'
