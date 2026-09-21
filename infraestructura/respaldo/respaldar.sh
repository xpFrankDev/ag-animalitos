#!/usr/bin/env sh
# Respaldo inteligente de la base de datos de AG · Animalitos.
#
# - Respalda solo la base de la aplicación (no el esquema interno de MariaDB).
# - Verifica que el volcado sea legible y contenga tablas antes de darlo por bueno.
# - Conserva tres generaciones: diaria, semanal (domingos) y mensual (días 1).
# - Opcionalmente copia fuera del servidor si RESPALDO_REMOTO está definido.
#
# Uso: ./infraestructura/respaldo/respaldar.sh
set -eu

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz"

if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

base="${MARIADB_DATABASE:-${DB_NOMBRE:-ag_loteria}}"
destino="${RESPALDO_DIR:-$HOME/respaldos-ag}"
retencion_diaria="${RESPALDO_DIAS:-7}"
retencion_semanal="${RESPALDO_SEMANAS:-4}"
retencion_mensual="${RESPALDO_MESES:-6}"
servicio="${RESPALDO_SERVICIO:-mariadb}"
marca="$(date +%Y-%m-%d_%H%M)"
archivo="ag_${base}_${marca}.sql.gz"

mkdir -p "$destino/diario" "$destino/semanal" "$destino/mensual" "$destino/registros"
log="$destino/registros/respaldos.log"

registrar() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" >>"$log"
}

fallar() {
  registrar "ERROR: $1"
  printf 'Respaldo fallido: %s\n' "$1" >&2
  exit 1
}

temporal="$destino/diario/$archivo.parcial"
trap 'rm -f "$temporal"' EXIT INT TERM

# La contraseña se expande dentro del contenedor: nunca queda en la línea de comandos del host.
registrar "Inicio del respaldo de $base"
docker compose exec -T "$servicio" sh -c \
  'mariadb-dump --user=root --password="$MARIADB_ROOT_PASSWORD" --single-transaction --quick --routines --events --triggers --databases "$MARIADB_DATABASE"' \
  2>>"$log" | gzip -9 >"$temporal" || fallar "mariadb-dump o gzip devolvieron error"

gzip -t "$temporal" 2>>"$log" || fallar "el archivo comprimido no es legible"
if ! gzip -dc "$temporal" | grep -q 'CREATE TABLE'; then
  fallar "el volcado no contiene definiciones de tablas"
fi

mv "$temporal" "$destino/diario/$archivo"
tamano="$(du -h "$destino/diario/$archivo" | cut -f1)"
registrar "Respaldo diario listo: $archivo ($tamano)"

# Generaciones adicionales: el mismo archivo entra en la carpeta que corresponde.
if [ "$(date +%u)" = "7" ]; then
  cp "$destino/diario/$archivo" "$destino/semanal/$archivo"
  registrar "Copia semanal creada"
fi
if [ "$(date +%d)" = "01" ]; then
  cp "$destino/diario/$archivo" "$destino/mensual/$archivo"
  registrar "Copia mensual creada"
fi

podar() {
  carpeta="$1"
  limite="$2"
  cantidad="$(ls -1 "$carpeta" 2>/dev/null | wc -l)"
  if [ "$cantidad" -gt "$limite" ]; then
    ls -1t "$carpeta" | tail -n +"$((limite + 1))" | while IFS= read -r viejo; do
      rm -f "$carpeta/$viejo"
      registrar "Retirado por retención: $viejo"
    done
  fi
}

podar "$destino/diario" "$retencion_diaria"
podar "$destino/semanal" "$retencion_semanal"
podar "$destino/mensual" "$retencion_mensual"

if [ -n "${RESPALDO_REMOTO:-}" ]; then
  if command -v rsync >/dev/null 2>&1; then
    rsync -az --delete "$destino/diario/" "$RESPALDO_REMOTO/" >>"$log" 2>&1 || fallar "no se pudo copiar al destino remoto"
    registrar "Copia remota actualizada en $RESPALDO_REMOTO"
  else
    registrar "AVISO: RESPALDO_REMOTO definido pero rsync no está instalado"
  fi
fi

# El registro no debe crecer sin control.
if [ "$(wc -c <"$log")" -gt 1048576 ]; then
  tail -n 500 "$log" >"$log.tmp" && mv "$log.tmp" "$log"
fi

rm -f "$temporal"
trap - EXIT INT TERM
printf 'Respaldo completado: %s/%s\n' "$destino/diario" "$archivo"
