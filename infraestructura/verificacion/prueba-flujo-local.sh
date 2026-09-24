#!/usr/bin/env sh
# Prueba de humo del flujo completo contra un entorno local ya levantado.
#
# Crea un grupero y una agencia temporales, vende dos tickets del mismo día
# (para comprobar la numeración diaria), registra un resultado, espera la
# calificación automática, paga el premio y borra todo lo que creó.
#
# Requisitos: docker compose en marcha y .env con las credenciales locales.
# Uso: ./infraestructura/verificacion/prueba-flujo-local.sh
set -eu

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz"

# shellcheck disable=SC1091
set -a
. ./.env
set +a

api="${PRUEBA_API:-http://localhost:8080/animalitos/api}"
sufijo="$(date +%s)"
export USUARIO_GRUPERO="${USUARIO_GRUPERO:-prueba_grupero_$sufijo}"
export USUARIO_AGENCIA="${USUARIO_AGENCIA:-prueba_agencia_$sufijo}"
export CLAVE="${CLAVE:-PruebaLocal.$sufijo!}"
export CODIGO="${CODIGO:-PR-$sufijo}"
export SERIAL_EQUIPO="${SERIAL_EQUIPO:-equipo-prueba-$sufijo}"
usuario_grupero="$USUARIO_GRUPERO"
usuario_agencia="$USUARIO_AGENCIA"
serial_equipo="$SERIAL_EQUIPO"

json() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const r=d$1;process.stdout.write(String(r ?? ''))"; }
limpiar_ascii() { tr -d '\r'; }

paso() { printf '\n== %s\n' "$1"; }

paso 'Inicio de sesión del banquero'
respuesta_banquero="$(curl -sS -X POST "$api/autenticacion/iniciar-sesion" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({nombre_usuario:process.env.USUARIO_BANQUERO_INICIAL,contrasena:process.env.CONTRASENA_BANQUERO_INICIAL}))")")"
token_banquero="$(printf '%s' "$respuesta_banquero" | json '.token')"
[ -n "$token_banquero" ] || { printf 'No se pudo iniciar sesión como banquero: %s\n' "$respuesta_banquero" >&2; exit 1; }
echo 'Sesión de banquero obtenida.'

# La comisión del panel suma la red completa: se guarda la base para medir solo
# el efecto de los tickets de esta prueba, aunque existan ventas de otras agencias.
comision_inicial="$(curl -sS "$api/operacion/inicio" -H "Authorization: Bearer $token_banquero" | json '.resumen.comision_gruperos')"

paso 'Alta de grupero y agencia temporales'
pk_grupero="$(curl -sS -X POST "$api/operacion/gruperos" -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({nombre_completo:'Grupero de prueba',nombre_usuario:process.env.USUARIO_GRUPERO,contrasena:process.env.CLAVE, cupo_animal: 300, comision_porcentaje: 4}))")" \
  | json '.pk_grupero')"
[ -n "$pk_grupero" ] || { echo 'No se pudo crear el grupero de prueba.' >&2; exit 1; }
export PK_GRUPERO="$pk_grupero"

pk_agencia="$(curl -sS -X POST "$api/operacion/agencias" -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({codigo_agencia:process.env.CODIGO,nombre_agencia:'Agencia de prueba',nombre_usuario:process.env.USUARIO_AGENCIA,contrasena:process.env.CLAVE,comision_porcentaje:12,cupo_animal:50,jugada_minima:1,minutos_cierre:5,fk_grupero:process.env.PK_GRUPERO}))")" \
  | json '.pk_agencia')"
[ -n "$pk_agencia" ] || { echo 'No se pudo crear la agencia de prueba.' >&2; exit 1; }
echo "Grupero y agencia temporales creados ($pk_agencia)."

paso 'Inicio de sesión de la agencia'
respuesta_agencia="$(curl -sS -X POST "$api/autenticacion/iniciar-sesion" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({nombre_usuario:process.env.USUARIO_AGENCIA,contrasena:process.env.CLAVE,serial_dispositivo:process.env.SERIAL_EQUIPO}))")")"
token_agencia="$(printf '%s' "$respuesta_agencia" | json '.token')"
[ -n "$token_agencia" ] || { printf 'No se pudo iniciar sesión como agencia: %s\n' "$respuesta_agencia" >&2; exit 1; }

paso 'Catálogo de la agencia'
inicio="$(curl -sS "$api/agencia/inicio" -H "Authorization: Bearer $token_agencia")"
fecha_juego="$(printf '%s' "$inicio" | json '.fecha_juego')"
seleccion="$(printf '%s' "$inicio" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const horario = d.horarios.find((h) => h.disponible);
if (!horario) { console.error('No hay sorteos abiertos: ejecuta la prueba dentro de la jornada de venta.'); process.exit(1); }
process.stdout.write([horario.pk_horario_sorteo, d.animales[0].pk_animal, horario.multiplicador_premio, horario.sorteo, horario.hora].join('|'));
")"
pk_horario="$(printf '%s' "$seleccion" | cut -d'|' -f1)"
pk_animal="$(printf '%s' "$seleccion" | cut -d'|' -f2)"
multiplicador="$(printf '%s' "$seleccion" | cut -d'|' -f3)"
export PK_ANIMAL="$pk_animal" PK_HORARIO="$pk_horario" FECHA="$fecha_juego"
echo "Fecha de juego: $fecha_juego · sorteo abierto: $(printf '%s' "$seleccion" | cut -d'|' -f4) $(printf '%s' "$seleccion" | cut -d'|' -f5) · multiplicador: $multiplicador"

cuerpo_jugada="$(node -e "process.stdout.write(JSON.stringify({jugadas:[{fk_animal:Number(process.env.PK_ANIMAL),fk_horario_sorteo:Number(process.env.PK_HORARIO),monto:10}]}))")"

paso 'Verificación de cupo previa a la impresión'
verificacion="$(curl -sS -X POST "$api/agencia/tickets/validar" -H "Authorization: Bearer $token_agencia" -H 'Content-Type: application/json' -d "$cuerpo_jugada")"
printf 'puede_emitir: %s\n' "$(printf '%s' "$verificacion" | json '.puede_emitir')"

paso 'Venta de dos tickets del mismo día'
primer_numero="$(curl -sS -X POST "$api/agencia/tickets" -H "Authorization: Bearer $token_agencia" -H 'Content-Type: application/json' -d "$cuerpo_jugada" | json '.numero_ticket')"
segundo="$(curl -sS -X POST "$api/agencia/tickets" -H "Authorization: Bearer $token_agencia" -H 'Content-Type: application/json' -d "$cuerpo_jugada")"
segundo_numero="$(printf '%s' "$segundo" | json '.numero_ticket')"
serial_segundo="$(printf '%s' "$segundo" | json '.serial')"
export SERIAL="$serial_segundo"
echo "Ticket 1: #$primer_numero · Ticket 2: #$segundo_numero"
[ "$primer_numero" = "1" ] || { echo 'La numeración no reinició en 1 para la jornada.' >&2; exit 1; }
[ "$segundo_numero" = "2" ] || { echo 'La numeración diaria no continuó en 2.' >&2; exit 1; }

paso 'Resultado y calificación automática'
curl -sS -X POST "$api/operacion/resultados" -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({fecha_juego:process.env.FECHA,fk_horario_sorteo:Number(process.env.PK_HORARIO),fk_animal:Number(process.env.PK_ANIMAL)}))")" >/dev/null

estado_ticket=''
intento=0
while [ "$intento" -lt 20 ]; do
  estado_ticket="$(curl -sS "$api/agencia/tickets?desde=$fecha_juego&hasta=$fecha_juego&tamano=100" -H "Authorization: Bearer $token_agencia" \
    | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const t=d.items.find((x)=>x.serial===process.env.SERIAL);process.stdout.write(t?t.estado:'')")"
  [ "$estado_ticket" = 'PREMIADO' ] && break
  intento=$((intento + 1))
  sleep 5
done
echo "Estado del ticket premiado: ${estado_ticket:-sin calificar}"
[ "$estado_ticket" = 'PREMIADO' ] || { echo 'La calificación automática no marcó el ticket como PREMIADO.' >&2; exit 1; }

paso 'Consulta y pago del premio'
pago="$(curl -sS "$api/agencia/tickets/$serial_segundo/pago" -H "Authorization: Bearer $token_agencia")"
total_pagar="$(printf '%s' "$pago" | json '.total_pagar')"
echo "Total a pagar: $total_pagar (10.00 jugado con multiplicador $multiplicador)"
curl -sS -X POST "$api/agencia/tickets/$serial_segundo/pagar" -H "Authorization: Bearer $token_agencia" | json '.mensaje'

paso 'Comisión del grupero sobre la venta de sus agencias'
panel="$(curl -sS "$api/operacion/inicio" -H "Authorization: Bearer $token_banquero")"
comision_gruperos="$(printf '%s' "$panel" | json '.resumen.comision_gruperos')"
venta_grupo="$(printf '%s' "$panel" | PK_GRUPERO="$pk_grupero" node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const fila = d.gruperos.find((grupero) => grupero.pk_grupero === process.env.PK_GRUPERO);
process.stdout.write(String(fila ? fila.venta_grupo : 'sin grupero'));
")"
echo "Venta del grupo: $venta_grupo · comisión de gruperos: $comision_gruperos (4% de la venta acumulada)"
[ "$venta_grupo" = '20' ] || { echo 'La venta del grupo no coincide con los dos tickets del mismo día.' >&2; exit 1; }
comision_prueba="$(node -e "process.stdout.write((Math.round((Number(process.argv[1]) - Number(process.argv[2])) * 100) / 100).toFixed(2))" "$comision_gruperos" "$comision_inicial")"
echo "Comisión generada por la prueba: $comision_prueba (4% de 20)"
[ "$comision_prueba" = '0.80' ] || { echo 'La comisión del grupero no se calculó sobre la venta acumulada.' >&2; exit 1; }

paso 'Bloqueo por intentos fallidos'
# Se bloquea la agencia de prueba: el panel del banquero solo lista accesos de su red.
export USUARIO="$usuario_agencia"

intentar_tres_veces() {
  for intento in 1 2 3; do
    respuesta="$(curl -sS -w '\n%{http_code}' -X POST "$api/autenticacion/iniciar-sesion" -H 'Content-Type: application/json' \
      -d "$(node -e "process.stdout.write(JSON.stringify({nombre_usuario:process.env.USUARIO,contrasena:'clave-incorrecta'}))")")"
    codigo="$(printf '%s' "$respuesta" | tail -n 1)"
    cuerpo="$(printf '%s' "$respuesta" | sed '$d')"
    printf 'Intento %s: HTTP %s\n' "$intento" "$codigo"
  done
}

# Libera el usuario desde el panel del banquero y limpia el bloqueo de IP que deja la prueba.
# Devuelve `pk|permanente|bloqueos` del bloqueo vigente del usuario, como lo ve el panel.
bloqueo_del_usuario() {
  curl -sS "$api/operacion/accesos" -H "Authorization: Bearer $token_banquero" | USUARIO="$usuario_agencia" node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const fila = d.find((acceso) => acceso.tipo === 'USUARIO' && acceso.clave === process.env.USUARIO && acceso.vigente);
process.stdout.write(fila ? [fila.pk_control_acceso, fila.permanente, fila.bloqueos_consecutivos].join('|') : '');
"
}

liberar_usuario_de_prueba() {
  fila="$(bloqueo_del_usuario)"
  [ -n "$fila" ] || { echo 'El bloqueo del usuario no aparece como vigente en el panel del banquero.' >&2; exit 1; }
  pk_acceso="$(printf '%s' "$fila" | cut -d'|' -f1)"
  curl -sS -X POST "$api/operacion/accesos/$pk_acceso/desbloquear" -H "Authorization: Bearer $token_banquero" | json '.mensaje'
}

# Simula el vencimiento del bloqueo corto del usuario y limpia el bloqueo de IP que deja la
# prueba en local (el panel solo libera usuarios y equipos de la red, no direcciones IP).
avanzar_tras_bloqueo() {
  docker compose exec -T mariadb sh -c "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" \"\$MARIADB_DATABASE\" -e \"DELETE FROM control_acceso WHERE tipo='IP'; UPDATE control_acceso SET bloqueado_hasta = NOW() - INTERVAL 1 MINUTE WHERE tipo='USUARIO' AND clave='$usuario_agencia';\""
}

verificar_bloqueo() {
  intentar_tres_veces
  [ "$codigo" = '429' ] || { echo "El bloqueo $1 no respondió 429." >&2; exit 1; }
  permanente="$(printf '%s' "$cuerpo" | json '.permanente')"
  [ "$permanente" = "$2" ] || { echo "El bloqueo $1 quedó con permanente=$permanente." >&2; exit 1; }
  if [ "$2" = 'false' ]; then
    minutos="$(printf '%s' "$cuerpo" | json '.reintentar_en_minutos')"
    [ "$minutos" = '5' ] || { echo "El bloqueo $1 no avisó 5 minutos (avisó $minutos)." >&2; exit 1; }
    echo "Bloqueo consecutivo $1: 5 minutos (HTTP 429)."
  else
    echo "Bloqueo consecutivo $1: permanente (HTTP 429)."
  fi
}

# 1) El aviso de 5 minutos y la liberación desde el panel del banquero.
intentar_tres_veces
[ "$codigo" = '429' ] || { echo 'El bloqueo corto no respondió 429.' >&2; exit 1; }
[ "$(printf '%s' "$cuerpo" | json '.permanente')" = 'false' ] || { echo 'El primer bloqueo no debería ser permanente.' >&2; exit 1; }
[ "$(printf '%s' "$cuerpo" | json '.reintentar_en_minutos')" = '5' ] || { echo 'El aviso no informa los 5 minutos.' >&2; exit 1; }
echo 'El aviso informa 5 minutos de bloqueo (HTTP 429).'
[ "$(printf '%s' "$(bloqueo_del_usuario)" | cut -d'|' -f2)" = 'false' ] || { echo 'El panel no muestra el bloqueo corto.' >&2; exit 1; }
liberar_usuario_de_prueba
avanzar_tras_bloqueo

# 2) Sin liberación manual, el tercer bloqueo consecutivo queda permanente.
verificar_bloqueo 1 false
avanzar_tras_bloqueo
verificar_bloqueo 2 false
avanzar_tras_bloqueo
verificar_bloqueo 3 true
[ "$(printf '%s' "$(bloqueo_del_usuario)" | cut -d'|' -f2)" = 'true' ] || { echo 'El panel no muestra el bloqueo permanente.' >&2; exit 1; }
liberar_usuario_de_prueba
avanzar_tras_bloqueo

paso 'La agencia vuelve a entrar tras la liberación'
codigo_final="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$api/autenticacion/iniciar-sesion" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({nombre_usuario:process.env.USUARIO_AGENCIA,contrasena:process.env.CLAVE,serial_dispositivo:process.env.SERIAL_EQUIPO}))")")"
echo "Inicio de sesión posterior a la liberación: HTTP $codigo_final"
[ "$codigo_final" = '201' ] || { echo 'La agencia no pudo entrar después de liberar el acceso.' >&2; exit 1; }

paso 'Limpieza de los datos de prueba'
docker compose exec -T mariadb sh -c "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" \"\$MARIADB_DATABASE\" <<SQL
DELETE jugada FROM jugadas_ticket jugada INNER JOIN tickets ticket ON ticket.pk_ticket = jugada.fk_ticket WHERE ticket.fk_agencia = '$pk_agencia';
DELETE FROM tickets WHERE fk_agencia = '$pk_agencia';
DELETE FROM resultados WHERE fecha_juego = '$fecha_juego' AND fk_horario_sorteo = $pk_horario AND origen = 'MANUAL';
DELETE FROM control_acceso WHERE clave IN ('$usuario_agencia', '$usuario_grupero', '$serial_equipo');
-- La prueba también bloquea la IP que ve el servidor desde Docker; se limpia solo aquí, en local.
DELETE FROM control_acceso WHERE tipo = 'IP' AND (clave LIKE '172.%' OR clave IN ('127.0.0.1', '::1') OR ultimo_intento_at >= NOW() - INTERVAL 10 MINUTE);
DELETE FROM agencias WHERE pk_agencia = '$pk_agencia';
DELETE FROM gruperos WHERE pk_grupero = '$pk_grupero';
DELETE FROM usuarios WHERE nombre_usuario IN ('$usuario_agencia', '$usuario_grupero');
SQL"

printf '\nPrueba de flujo completada y datos temporales eliminados.\n'
