# AG · Animalitos

Sistema de venta de animalitos para taquillas venezolanas, con jerarquía de operación
Agencia–Grupero–Banquero, control de cupos, premios por sorteo y resultados automáticos.

## Estructura

- `frontend/`: React + Vite, temas claro/oscuro e i18n español/italiano.
- `backend/`: NestJS, TypeORM, MariaDB, JWT y calificación automática de tickets.
- `ScrapResultados/`: servicio NestJS que recolecta resultados de las fuentes públicas.
- `infraestructura/`: MariaDB, Nginx, despliegue y respaldos.

## Jerarquía de operación

| Rol | Puede hacer |
| --- | --- |
| Agencia | Vender tickets, anular, repetir, pagar premios y consultar su resumen. Solo opera desde el equipo asignado a su taquilla. |
| Grupero | Administrar (crear, editar, desactivar) las agencias de su grupo, liberar equipos, ver tickets y resultados de su grupo. No define comisiones. |
| Banquero | Administrar gruperos y todas las agencias de su red, definir comisiones por agencia, cupos, liberar equipos y desbloquear accesos. |

El cupo se controla en dos niveles: por agencia y compartido por grupero. Al vender, el
sistema bloquea primero al grupero y después a la agencia, y suma el consumo por
combinación (animal + sorteo) en una sola consulta.

La comisión de la agencia la define el banquero y se aplica sobre la venta de esa agencia.
La comisión del grupero se define igual por porcentaje, pero se calcula sobre la venta
acumulada de **todas** las agencias de su grupo en el rango consultado.

## Reglas implementadas

- Catálogo de animales por listas: la clásica usa 38 animales (`00`, `0` y `1` a `36`) y
  Guácharo Activo usa 77 (`00`, `0` y `1` a `75`).
- Sorteos Lotto Activo, La Granjita, Lotto Internacional y Guácharo Activo, con 12 horarios
  cada uno. Guácharo sortea las mismas horas que Lotto Activo y La Granjita.
- **Cada sorteo declara su lista de animales y la taquilla dibuja solo esa lista.** Elegir un
  sorteo de otra lista reemplaza los sorteos marcados: un ticket no puede mezclar listas.
- Cada sorteo define su propio multiplicador de premio: 30 en los clásicos y 60 en Guácharo Activo.
- Selección múltiple de animales y sorteos; Enter en el monto agrega las combinaciones.
- Jugada mínima, minutos de cierre y cupo diario configurable por agencia.
- **Numeración de tickets por jornada y por agencia: cada día el primer ticket vuelve a 1.**
  Por eso repetir un ticket pide fecha y número.
- Estados reales: `ACTIVO → PREMIADO → PAGADO`, más `CANCELADO` dentro de la ventana de anulación.
  El premio se marca automáticamente cuando el resultado del sorteo se registra.
- Serial único de 8 dígitos por ticket; las jugadas anuladas dejan de ocupar cupo.
- Esquema versionado en migraciones TypeORM. No se usa `synchronize`.

## Impresión de la tirilla

La tirilla se compone en `frontend/src/funcionalidades/agencia/ticket.ts` con el formato
`numero-nombre reducido x monto`, agrupado por sorteo y hora ascendente: las jugadas del
mismo horario comparten bloque y cada animal conserva su propia entrada. El mismo texto
alimenta la vista previa y la impresora.

Al imprimir solo se envía el ticket, en flujo normal y a 58 mm de ancho. El tamaño de hoja
lo define el controlador de la impresora térmica: fijarlo en CSS cortaba la tirilla y el
navegador repetía el ticket en una segunda hoja.

Cada agencia tiene su propio `salto_linea`: los renglones en blanco que se imprimen después
del total y de la cantidad de jugadas. Se edita desde el panel del grupero o del banquero y
su valor por defecto es 0 (impresión sin espacio adicional).

## Zona horaria

Toda la operación (fecha de juego, cierre de sorteos, numeración diaria y resultados) se
calcula en `America/Caracas`, aunque el servidor esté en otra zona horaria como Argentina.
La variable `ZONA_HORARIA` permite cambiarla si el negocio se traslada.

## Resultados y premios

1. `ScrapResultados` consulta las fuentes públicas cuatro veces por hora entre 08:00 y 19:59
   (hora de Venezuela) e inserta los resultados nuevos sin duplicar ni sobrescribir. Las
   fuentes son Lotto Activo y Lotto Internacional (lottoactivo.com), La Granjita y
   Guácharo Activo (loteriadehoy.com).
2. La API detecta los resultados pendientes (`aplicado_at` nulo) y **califica los tickets**:
   marca las jugadas ganadoras como `PREMIADA` y sus tickets como `PREMIADO`.
3. Al pagar, el premio se calcula con el multiplicador del sorteo ganador y el ticket pasa a
   `PAGADO`; si un resultado se corrige, la calificación recalcula el horario.

El registro manual de resultados existe únicamente como contingencia para el banquero y queda
identificado con origen `MANUAL`. El banquero puede corregirlo y eliminar un resultado manual
mientras no se haya aplicado a los tickets. No es el camino esperado.

## Seguridad

- Sesión JWT de 10 minutos y contraseñas con bcrypt (12 rondas).
- Equipo vinculado por taquilla: cada PC y navegador recibe un código único (huella del
  dispositivo más identificador propio del navegador). Si la taquilla cambia de equipo o de
  navegador, el grupero o banquero debe liberar el equipo asignado antes de volver a entrar.
- **Bloqueo de acceso: 3 intentos fallidos bloquean 5 minutos; al tercer bloqueo de un mismo
  alcance el acceso queda bloqueado de forma permanente y solo lo libera el grupero o el
  banquero.** Se controla por usuario, por IP y por equipo, y se guarda en la base de datos
  para sobrevivir reinicios. El conteo de bloqueos consecutivos se reinicia con un inicio de
  sesión exitoso o cuando el grupero o banquero libera el acceso desde el panel.
- Los bloqueos vigentes aparecen en el panel de Grupero/Banquero y pueden liberarse ahí mismo.
- Swagger queda deshabilitado por defecto en producción y Nginx bloquea su ruta pública.

## Respaldos

`infraestructura/respaldo/respaldar.sh` ejecuta un volcado verificado de la base de la
aplicación y conserva tres generaciones (diaria, semanal y mensual) con poda automática.

```sh
./infraestructura/respaldo/instalar-cron.sh   # respaldo diario a las 02:00 de Venezuela
./infraestructura/respaldo/respaldar.sh       # respaldo manual
CONFIRMAR_RESTAURACION=si ./infraestructura/respaldo/restaurar.sh /ruta/respaldo.sql.gz
```

Variables opcionales: `RESPALDO_DIR`, `RESPALDO_DIAS`, `RESPALDO_SEMANAS`, `RESPALDO_MESES`
y `RESPALDO_REMOTO` (copia externa con `rsync`).

## Arranque local

1. Copia `.env.example` como `.env` y reemplaza los secretos. En local usa `APP_HOST_IP=127.0.0.1`.
2. Instala y abre Docker Desktop.
3. Ejecuta `docker compose up --build -d`.

Compose construye frontend, API, recolector y MariaDB; aplica migraciones, carga la semilla
idempotente y publica la aplicación en `http://localhost:8080`. La base no se expone a Internet.
Los datos de demostración solo se crean con `SEMILLA_DATOS_DEMO=true`; la cuenta raíz
(banquero) se crea siempre a partir de `USUARIO_BANQUERO_INICIAL` y `CONTRASENA_BANQUERO_INICIAL`.

## Verificación

Cada aplicación tiene sus propias comprobaciones y el repositorio las ejecuta en CI
(`.github/workflows/verificacion.yml`):

```sh
cd backend && npm run lint && npm test && npm run build
cd frontend && npm run lint && npm run build
cd ScrapResultados && npm test && npm run build
```

Con los contenedores en marcha, `GET http://localhost:8080/animalitos/api/salud` informa el
estado de la API, la fecha de juego vigente y cuántos resultados quedan por calificar.

`infraestructura/verificacion/prueba-flujo-local.sh` ejecuta una prueba de humo completa
contra el entorno local: crea un grupero y una agencia temporales, vende dos tickets del
mismo día para comprobar la numeración diaria, registra un resultado, espera la calificación
automática, paga el premio y borra los datos que creó. Requiere que el entorno esté levantado
y debe ejecutarse dentro de la jornada de venta.

`infraestructura/verificacion/prueba-cupos-local.sh` comprueba el doble control de cupo:
que la venta descuente el cupo propio de la agencia, que una jugada que lo excede se rechace
y que el cupo general del grupero se valide entre todas sus agencias. También crea datos
temporales y los elimina al terminar.

`infraestructura/verificacion/prueba-guacharo-local.sh` comprueba la lista propia de
Guácharo Activo: que acepta el animal 40, que los sorteos clásicos lo rechazan, que no se
pueden mezclar listas en un mismo ticket y que el premio se paga con multiplicador 60.

## Despliegue en VPS

1. Clona el repositorio en `/home/deploy/ag`, crea `.env` desde `.env.example` y ajusta los valores.
2. Instala una vez el wrapper `infraestructura/privilegios/ag-nginx-deploy` como
   `/usr/local/sbin/ag-nginx-deploy`.
3. Ejecuta `sudo /usr/local/sbin/ag-nginx-deploy` y luego `docker compose up --build -d`.
4. Emite TLS con `sudo certbot --nginx -d tu-dominio` cuando el DNS apunte al VPS.

Los cambios se acumulan y se despliegan una sola vez, tras confirmación explícita.
El VPS está en otra zona horaria: no cambies `ZONA_HORARIA`, la operación es venezolana.

## Variables de entorno relevantes

| Variable | Uso |
| --- | --- |
| `ZONA_HORARIA` | Zona de la operación. Por defecto `America/Caracas`. |
| `SWAGGER_HABILITADO` | Publica `/api/documentacion`. `false` en producción. |
| `ACCESO_INTENTOS_PERMITIDOS` | Intentos antes del bloqueo corto (3). |
| `ACCESO_MINUTOS_BLOQUEO` | Duración del bloqueo corto (5). |
| `ACCESO_BLOQUEOS_ANTES_DE_BLOQUEO_PERMANENTE` | Bloqueos antes del bloqueo permanente (3). |
| `CALIFICACION_ACTIVA` / `CALIFICACION_INTERVALO_MS` | Calificación automática de premios. |
| `SEMILLA_DATOS_DEMO` | Crea grupero y agencia de demostración. Solo desarrollo. |

## Datos y migraciones

La base se llama `ag_loteria`. La aplicación usa `ag_aplicacion` con permisos de uso normal;
las migraciones usan `ag_migraciones`, con DDL limitado a esa base; el recolector usa
`scrap_resultados` con permisos mínimos sobre `animales`, `sorteos`, `horarios_sorteo` y
`resultados`. No subas archivos `.env` ni valores de credenciales al repositorio.
