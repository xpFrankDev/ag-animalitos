#!/usr/bin/env sh
# Restauración de un respaldo de AG · Animalitos.
#
# La restauración reemplaza la base completa, así que exige confirmación explícita:
#   CONFIRMAR_RESTAURACION=si ./infraestructura/respaldo/restaurar.sh /ruta/respaldo.sql.gz
set -eu

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz"

archivo="${1:-}"
if [ -z "$archivo" ] || [ ! -f "$archivo" ]; then
  echo 'Uso: restaurar.sh /ruta/al/respaldo.sql.gz' >&2
  exit 1
fi
if [ "${CONFIRMAR_RESTAURACION:-}" != "si" ]; then
  echo 'La restauración reemplaza la base de datos. Repite el comando con CONFIRMAR_RESTAURACION=si.' >&2
  exit 1
fi

if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

base="${MARIADB_DATABASE:-${DB_NOMBRE:-ag_loteria}}"
servicio="${RESPALDO_SERVICIO:-mariadb}"

gzip -t "$archivo" || { echo 'El archivo no es un respaldo válido.' >&2; exit 1; }
echo "Restaurando $archivo sobre $base..."
gzip -dc "$archivo" | docker compose exec -T "$servicio" sh -c 'mariadb --user=root --password="$MARIADB_ROOT_PASSWORD"'
echo 'Restauración completada. Reinicia los servicios: docker compose up -d --force-recreate backend'
