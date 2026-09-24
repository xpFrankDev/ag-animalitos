#!/usr/bin/env sh
# Verificación del doble control de cupo contra un entorno local ya levantado.
#
# Crea un grupero (cupo 12) con dos agencias (cupo 10 cada una) y comprueba que:
#   1. la venta descuenta el cupo propio de la agencia;
#   2. una jugada que excede el cupo de la agencia se rechaza;
#   3. el cupo general del grupero se valida entre todas sus agencias.
# Al final elimina todo lo que creó.
#
# Requisitos: docker compose en marcha y .env con las credenciales locales.
# Uso: ./infraestructura/verificacion/prueba-cupos-local.sh
set -eu

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz"

# shellcheck disable=SC1091
set -a
. ./.env
set +a

api="${PRUEBA_API:-http://localhost:8080/animalitos/api}"
sufijo="$(date +%s)"
usuario_grupero="cupo_g_$sufijo"
usuario_agencia_1="cupo_a1_$sufijo"
usuario_agencia_2="cupo_a2_$sufijo"
clave="CupoLocal.$sufijo!"

json() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const r=d$1;process.stdout.write(String(r ?? ''))"; }
paso() { printf '\n== %s\n' "$1"; }
sesion() {
  curl -sS -X POST "$api/autenticacion/iniciar-sesion" -H 'Content-Type: application/json' \
    -d "$(node -e "process.stdout.write(JSON.stringify({nombre_usuario:process.argv[1],contrasena:process.argv[2],serial_dispositivo:process.argv[3]}))" "$1" "$2" "$3")"
}

paso 'Sesión del banquero'
token_banquero="$(sesion "$USUARIO_BANQUERO_INICIAL" "$CONTRASENA_BANQUERO_INICIAL" "cupo-banquero-$sufijo" | json '.token')"
[ -n "$token_banquero" ] || { echo 'No se pudo iniciar sesión como banquero.' >&2; exit 1; }

paso 'Grupero con cupo 12 y dos agencias con cupo 10'
pk_grupero="$(curl -sS -X POST "$api/operacion/gruperos" -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({nombre_completo:'Grupero cupo',nombre_usuario:process.argv[1],contrasena:process.argv[2],cupo_animal:12,comision_porcentaje:3}))" "$usuario_grupero" "$clave")" | json '.pk_grupero')"
[ -n "$pk_grupero" ] || { echo 'No se pudo crear el grupero de prueba.' >&2; exit 1; }

crear_agencia() {
  curl -sS -X POST "$api/operacion/agencias" -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
    -d "$(node -e "process.stdout.write(JSON.stringify({codigo_agencia:process.argv[2],nombre_agencia:'Agencia cupo',nombre_usuario:process.argv[1],contrasena:process.argv[3],comision_porcentaje:12,cupo_animal:10,jugada_minima:1,minutos_cierre:5,fk_grupero:process.argv[4]}))" "$1" "$2" "$clave" "$pk_grupero")" \
    | json '.pk_agencia'
}
pk_agencia_1="$(crear_agencia "$usuario_agencia_1" "CP-A-$sufijo")"
pk_agencia_2="$(crear_agencia "$usuario_agencia_2" "CP-B-$sufijo")"
[ -n "$pk_agencia_1" ] && [ -n "$pk_agencia_2" ] || { echo 'No se pudieron crear las agencias de prueba.' >&2; exit 1; }
echo "Grupero y agencias listos ($pk_agencia_1, $pk_agencia_2)."

paso 'Catálogo de la primera agencia'
token_agencia_1="$(sesion "$usuario_agencia_1" "$clave" "cupo-a1-$sufijo" | json '.token')"
[ -n "$token_agencia_1" ] || { echo 'La primera agencia no pudo entrar.' >&2; exit 1; }
export SUFIJO="$sufijo"
inicio="$(curl -sS "$api/agencia/inicio" -H "Authorization: Bearer $token_agencia_1")"
seleccion="$(printf '%s' "$inicio" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const horario = d.horarios.find((h) => h.disponible);
if (!horario) { console.error('No hay sorteos abiertos: ejecuta la prueba dentro de la jornada de venta.'); process.exit(1); }
process.stdout.write([horario.pk_horario_sorteo, d.animales[0].pk_animal].join('|'));
")"
pk_horario="$(printf '%s' "$seleccion" | cut -d'|' -f1)"
pk_animal="$(printf '%s' "$seleccion" | cut -d'|' -f2)"

cuerpo() {
  node -e "process.stdout.write(JSON.stringify({jugadas:[{fk_animal:Number(process.argv[1]),fk_horario_sorteo:Number(process.argv[2]),monto:Number(process.argv[3])}]}))" "$pk_animal" "$pk_horario" "$1"
}
validar() {
  curl -sS -X POST "$api/agencia/tickets/validar" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$(cuerpo "$2")"
}
vender() {
  curl -sS -o /dev/null -X POST "$api/agencia/tickets" -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$(cuerpo "$2")"
}
comprobar() {
  obtenido="$(printf '%s' "$3" | json '.puede_emitir')"
  detalle="$(printf '%s' "$3" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const i=(d.detalle||[])[0]||{};process.stdout.write([i.excedido??'ok','agencia '+i.disponible_agencia,'grupero '+i.disponible_grupero].join(' · '))")"
  printf '%-52s puede_emitir=%s (%s)\n' "$1" "$obtenido" "$detalle"
  [ "$obtenido" = "$2" ] || { echo "La verificación falló: se esperaba puede_emitir=$2." >&2; exit 1; }
}

paso 'Cupo propio de la agencia (10)'
comprobar 'la agencia vende 8 de 10' true "$(validar "$token_agencia_1" 8)"
vender "$token_agencia_1" 8
comprobar 'tras vender 8, otra jugada de 3 excede la agencia' false "$(validar "$token_agencia_1" 3)"
comprobar 'tras vender 8, otra jugada de 2 completa el cupo' true "$(validar "$token_agencia_1" 2)"

paso 'Cupo general del grupero (12 entre todas sus agencias)'
token_agencia_2="$(sesion "$usuario_agencia_2" "$clave" "cupo-a2-$sufijo" | json '.token')"
[ -n "$token_agencia_2" ] || { echo 'La segunda agencia no pudo entrar.' >&2; exit 1; }
comprobar 'la segunda agencia con 8 choca con el cupo del grupero' false "$(validar "$token_agencia_2" 8)"
comprobar 'la segunda agencia con 4 respeta el cupo del grupero' true "$(validar "$token_agencia_2" 4)"
vender "$token_agencia_2" 4
comprobar 'con el grupero al límite, 1 más se rechaza' false "$(validar "$token_agencia_2" 1)"

paso 'Limpieza de los datos de prueba'
docker compose exec -T mariadb sh -c "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" \"\$MARIADB_DATABASE\" <<SQL
DELETE jugada FROM jugadas_ticket jugada INNER JOIN tickets ticket ON ticket.pk_ticket = jugada.fk_ticket WHERE ticket.fk_agencia IN ('$pk_agencia_1', '$pk_agencia_2');
DELETE FROM tickets WHERE fk_agencia IN ('$pk_agencia_1', '$pk_agencia_2');
DELETE FROM control_acceso WHERE clave IN ('$usuario_agencia_1', '$usuario_agencia_2', '$usuario_grupero');
DELETE FROM agencias WHERE pk_agencia IN ('$pk_agencia_1', '$pk_agencia_2');
DELETE FROM gruperos WHERE pk_grupero = '$pk_grupero';
DELETE FROM usuarios WHERE nombre_usuario IN ('$usuario_agencia_1', '$usuario_agencia_2', '$usuario_grupero');
SQL"

printf '\nPrueba de cupos completada y datos temporales eliminados.\n'
