#!/bin/sh
# Permisos mínimos del recolector de resultados.
#
# Se ejecuta como servicio de una sola vez, después de las migraciones, porque MariaDB
# no permite otorgar privilegios sobre tablas que todavía no existen.
set -eu

# El recolector usa un único usuario en dos variables equivalentes: las del contenedor de
# MariaDB (MARIADB_SCRAP_*) y las del propio servicio (SCRAP_DB_*).
usuario="${MARIADB_SCRAP_USUARIO:-${SCRAP_DB_USUARIO:-}}"
contrasena="${MARIADB_SCRAP_CONTRASENA:-${SCRAP_DB_CONTRASENA:-}}"
if [ -z "$usuario" ] || [ -z "$contrasena" ]; then
  echo 'Faltan MARIADB_SCRAP_USUARIO/CONTRASENA o SCRAP_DB_USUARIO/CONTRASENA en el entorno.' >&2
  exit 1
fi

mariadb --host="${DB_HOST:-mariadb}" --user=root --password="${MARIADB_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS '${usuario}'@'%' IDENTIFIED BY '${contrasena}';
GRANT SELECT ON \`${MARIADB_DATABASE}\`.animales TO '${usuario}'@'%';
GRANT SELECT ON \`${MARIADB_DATABASE}\`.sorteos TO '${usuario}'@'%';
GRANT SELECT ON \`${MARIADB_DATABASE}\`.horarios_sorteo TO '${usuario}'@'%';
GRANT SELECT, INSERT ON \`${MARIADB_DATABASE}\`.resultados TO '${usuario}'@'%';
FLUSH PRIVILEGES;
SQL

echo 'Permisos del recolector de resultados aplicados.'
