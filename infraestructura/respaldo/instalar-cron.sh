#!/usr/bin/env sh
# Instala el respaldo diario a las 02:00 (hora de Venezuela) para el usuario actual.
set -eu

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
linea="CRON_TZ=America/Caracas
0 2 * * * cd $raiz && ./infraestructura/respaldo/respaldar.sh >> $HOME/respaldos-ag/registros/cron.log 2>&1"

mkdir -p "$HOME/respaldos-ag/registros"
actual="$(crontab -l 2>/dev/null || true)"
if printf '%s' "$actual" | grep -q 'respaldar.sh'; then
  echo 'El respaldo diario ya estaba programado.'
  exit 0
fi

printf '%s\n%s\n' "$actual" "$linea" | crontab -
echo 'Respaldo diario programado a las 02:00 de Venezuela.'
