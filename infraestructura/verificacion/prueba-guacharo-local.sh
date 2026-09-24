#!/usr/bin/env sh
# Verificación de Guácharo Activo contra un entorno local ya levantado.
#
# Comprueba que el sorteo usa su propia lista de animales (00, 0 y 1 a 75), que no se puede
# mezclar con los sorteos clásicos en un mismo ticket y que el premio se paga con su
# multiplicador de 60. Al final elimina todo lo que creó.
#
# Requisitos: docker compose en marcha y .env con las credenciales locales.
# Uso: ./infraestructura/verificacion/prueba-guacharo-local.sh
set -eu

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$raiz"

# shellcheck disable=SC1091
set -a
. ./.env
set +a

api="${PRUEBA_API:-http://localhost:8080/animalitos/api}"
sufijo="$(date +%s)"
usuario_grupero="guacharo_g_$sufijo"
usuario_agencia="guacharo_a_$sufijo"
clave="GuacharoLocal.$sufijo!"
codigo_agencia="GA-$sufijo"
serial_equipo="guacharo-equipo-$sufijo"

json() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const r=d$1;process.stdout.write(String(r ?? ''))"; }
paso() { printf '\n== %s\n' "$1"; }
sesion() {
  curl -sS -X POST "$api/autenticacion/iniciar-sesion" -H 'Content-Type: application/json' \
    -d "$(node -e "process.stdout.write(JSON.stringify({nombre_usuario:process.argv[1],contrasena:process.argv[2],serial_dispositivo:process.argv[3]}))" "$1" "$2" "$3")"
}

paso 'Sesión del banquero'
token_banquero="$(sesion "$USUARIO_BANQUERO_INICIAL" "$CONTRASENA_BANQUERO_INICIAL" "guacharo-banquero-$sufijo" | json '.token')"
[ -n "$token_banquero" ] || { echo 'No se pudo iniciar sesión como banquero.' >&2; exit 1; }

paso 'Grupero y agencia temporales'
pk_grupero="$(curl -sS -X POST "$api/operacion/gruperos" -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({nombre_completo:'Grupero guácharo',nombre_usuario:process.argv[1],contrasena:process.argv[2],cupo_animal:500,comision_porcentaje:3}))" "$usuario_grupero" "$clave")" | json '.pk_grupero')"
[ -n "$pk_grupero" ] || { echo 'No se pudo crear el grupero de prueba.' >&2; exit 1; }

pk_agencia="$(curl -sS -X POST "$api/operacion/agencias" -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
  -d "$(node -e "process.stdout.write(JSON.stringify({codigo_agencia:process.argv[2],nombre_agencia:'Agencia guácharo',nombre_usuario:process.argv[1],contrasena:process.argv[3],comision_porcentaje:12,cupo_animal:100,jugada_minima:1,minutos_cierre:5,fk_grupero:process.argv[4]}))" "$usuario_agencia" "$codigo_agencia" "$clave" "$pk_grupero")" | json '.pk_agencia')"
[ -n "$pk_agencia" ] || { echo 'No se pudo crear la agencia de prueba.' >&2; exit 1; }
echo "Grupero y agencia listos ($pk_agencia)."

paso 'Sesión de la agencia y catálogo con listas'
token_agencia="$(sesion "$usuario_agencia" "$clave" "$serial_equipo" | json '.token')"
[ -n "$token_agencia" ] || { echo 'La agencia no pudo entrar.' >&2; exit 1; }

inicio="$(curl -sS "$api/agencia/inicio" -H "Authorization: Bearer $token_agencia")"
seleccion="$(printf '%s' "$inicio" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const guacharo = d.horarios.find((h) => h.sorteo === 'Guácharo Activo' && h.disponible);
const clasico = d.horarios.find((h) => h.sorteo === 'Lotto Activo' && h.disponible);
const avispa = d.animales.find((a) => a.codigo_animal === '40');
const ballena = d.animales.find((a) => a.codigo_animal === '00');
const grupoGuacharo = d.grupos.find((g) => g.nombre === 'Guácharo');
const grupoClasico = d.grupos.find((g) => g.nombre === 'Clásico');
if (!guacharo || !clasico || !avispa || !grupoGuacharo || !grupoClasico) {
  console.error('Falta el catálogo de Guácharo Activo o no hay sorteos abiertos: ejecuta la prueba dentro de la jornada de venta.');
  process.exit(1);
}
process.stdout.write([guacharo.pk_horario_sorteo, clasico.pk_horario_sorteo, avispa.pk_animal, ballena.pk_animal, grupoGuacharo.animales.length, grupoClasico.animales.length].join('|'));
")"
pk_horario_guacharo="$(printf '%s' "$seleccion" | cut -d'|' -f1)"
pk_horario_clasico="$(printf '%s' "$seleccion" | cut -d'|' -f2)"
pk_avispa="$(printf '%s' "$seleccion" | cut -d'|' -f3)"
pk_ballena="$(printf '%s' "$seleccion" | cut -d'|' -f4)"
animales_guacharo="$(printf '%s' "$seleccion" | cut -d'|' -f5)"
animales_clasico="$(printf '%s' "$seleccion" | cut -d'|' -f6)"
echo "Lista clásica: $animales_clasico animales · Lista Guácharo: $animales_guacharo animales"
[ "$animales_clasico" -lt "$animales_guacharo" ] || { echo 'La lista de Guácharo debería ser más amplia que la clásica.' >&2; exit 1; }

comprobar_rechazo() {
  codigo="$(curl -sS -o /tmp/guacharo-validacion.json -w '%{http_code}' -X POST "$api/agencia/tickets/validar" \
    -H "Authorization: Bearer $token_agencia" -H 'Content-Type: application/json' -d "$2")"
  mensaje="$(json '.message' < /tmp/guacharo-validacion.json)"
  printf '%-58s HTTP %s · %s\n' "$1" "$codigo" "$mensaje"
  [ "$codigo" = '400' ] || { echo 'Se esperaba un rechazo de la API.' >&2; exit 1; }
}

paso 'La lista de Guácharo acepta el animal 40'
curl -sS -o /tmp/guacharo-validacion.json -w 'HTTP %{http_code}\n' -X POST "$api/agencia/tickets/validar" \
  -H "Authorization: Bearer $token_agencia" -H 'Content-Type: application/json' \
  -d "{\"jugadas\":[{\"fk_animal\":$pk_avispa,\"fk_horario_sorteo\":$pk_horario_guacharo,\"monto\":2}]}"
[ "$(json '.puede_emitir' < /tmp/guacharo-validacion.json)" = 'true' ] || { echo 'Guácharo Activo debería aceptar el animal 40.' >&2; exit 1; }

paso 'Los sorteos clásicos rechazan el animal 40'
comprobar_rechazo 'Lotto Activo con el animal 40' \
  "{\"jugadas\":[{\"fk_animal\":$pk_avispa,\"fk_horario_sorteo\":$pk_horario_clasico,\"monto\":1}]}"

paso 'No se pueden mezclar listas en un mismo ticket'
comprobar_rechazo 'Guácharo Activo + Lotto Activo' \
  "{\"jugadas\":[{\"fk_animal\":$pk_avispa,\"fk_horario_sorteo\":$pk_horario_guacharo,\"monto\":1},{\"fk_animal\":$pk_ballena,\"fk_horario_sorteo\":$pk_horario_clasico,\"monto\":1}]}"

paso 'Venta de un ticket de Guácharo Activo (2 al animal 40)'
ticket="$(curl -sS -X POST "$api/agencia/tickets" -H "Authorization: Bearer $token_agencia" -H 'Content-Type: application/json' \
  -d "{\"jugadas\":[{\"fk_animal\":$pk_avispa,\"fk_horario_sorteo\":$pk_horario_guacharo,\"monto\":2}]}")"
serial_ticket="$(printf '%s' "$ticket" | json '.serial')"
numero_ticket="$(printf '%s' "$ticket" | json '.numero_ticket')"
fecha_juego="$(printf '%s' "$ticket" | json '.fecha_juego')"
[ -n "$serial_ticket" ] || { echo "No se pudo emitir el ticket: $ticket" >&2; exit 1; }
echo "Ticket $numero_ticket emitido (serial $serial_ticket)."

paso 'Resultado del sorteo'
curl -sS -o /tmp/guacharo-resultado.json -w 'HTTP %{http_code}\n' -X POST "$api/operacion/resultados" \
  -H "Authorization: Bearer $token_banquero" -H 'Content-Type: application/json' \
  -d "{\"fecha_juego\":\"$fecha_juego\",\"fk_horario_sorteo\":$pk_horario_guacharo,\"fk_animal\":$pk_avispa}"
curl -sS -X GET "$api/operacion/resultados?fecha=$fecha_juego" -H "Authorization: Bearer $token_banquero" -o /dev/null

paso 'Calificación automática y premio con multiplicador 60'
estado=''
intento=0
while [ "$intento" -lt 18 ]; do
  intento=$((intento + 1))
  pago="$(curl -sS "$api/agencia/tickets/$serial_ticket/pago" -H "Authorization: Bearer $token_agencia")"
  total_pagar="$(printf '%s' "$pago" | json '.total_pagar')"
  if [ -n "$total_pagar" ] && [ "$(node -e "process.stdout.write(Number(process.argv[1]) > 0 ? 'si' : 'no')" "$total_pagar")" = 'si' ]; then
    estado='premiado'
    break
  fi
  sleep 5
done
[ "$estado" = 'premiado' ] || { echo 'El ticket no apareció premiado; revisa el resultado registrado.' >&2; exit 1; }

multiplicador="$(printf '%s' "$pago" | json '.jugadas_premiadas[0].multiplicador_premio')"
premio="$(printf '%s' "$pago" | json '.jugadas_premiadas[0].premio')"
echo "Multiplicador aplicado: $multiplicador · premio de la jugada: $premio · total a pagar: $total_pagar"
[ "$multiplicador" = '60' ] || { echo 'Guácharo Activo debería pagar 60 por cada 1.' >&2; exit 1; }
[ "$(node -e "process.stdout.write(String(Number(process.argv[1]) === 120 ? 'si' : 'no'))" "$total_pagar")" = 'si' ] || { echo 'El premio esperado era 120 para una jugada de 2 con multiplicador 60.' >&2; exit 1; }

paso 'Limpieza de los datos de prueba'
docker compose exec -T mariadb sh -c "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" \"\$MARIADB_DATABASE\" <<SQL
DELETE jugada FROM jugadas_ticket jugada INNER JOIN tickets ticket ON ticket.pk_ticket = jugada.fk_ticket WHERE ticket.fk_agencia = '$pk_agencia';
DELETE FROM tickets WHERE fk_agencia = '$pk_agencia';
DELETE FROM resultados WHERE fecha_juego = '$fecha_juego' AND fk_horario_sorteo = $pk_horario_guacharo AND origen = 'MANUAL';
DELETE FROM control_acceso WHERE clave IN ('$usuario_agencia', '$usuario_grupero', '$serial_equipo');
DELETE FROM agencias WHERE pk_agencia = '$pk_agencia';
DELETE FROM gruperos WHERE pk_grupero = '$pk_grupero';
DELETE FROM usuarios WHERE nombre_usuario IN ('$usuario_agencia', '$usuario_grupero');
SQL"

printf '\nPrueba de Guácharo Activo completada y datos temporales eliminados.\n'
