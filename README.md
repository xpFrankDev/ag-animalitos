# AG · Animalitos

Primera versión del sistema de venta de animalitos. El alcance actual es el inicio de sesión propio y la venta desde una Agencia. Los módulos de Grupero y Banquero se añadirán después de definir sus pantallas y operaciones.

## Estructura

- `frontend/`: React + Vite, temas claro/oscuro e i18n español/italiano.
- `backend/`: NestJS, TypeORM, MariaDB, JWT y Swagger UI.
- `infraestructura/`: inicialización local de MariaDB.

## Reglas implementadas

- Roles de Agencia, Grupero y Banquero; la pantalla actual solo permite operar al usuario Agencia.
- 38 animales: `00`, `0` y `1` a `36`.
- Horarios configurados para Lotto Activo, La Granjita y Lotto Internacional.
- Selección múltiple de animales y sorteos; Enter en el monto agrega las combinaciones y conserva el monto.
- Jugada mínima, cierre configurable, cupo diario por Agencia y cupo diario compartido por Grupero.
- Ticket con serial único, numeración por Agencia/día, cancelación limitada por tiempo y jugadas canceladas excluidas del cupo.
- Esquema inicial versionado en una migración TypeORM. No se usa `synchronize`.

## Arranque local

1. Copia `.env.example` como `.env` y reemplaza los secretos. Para el entorno local, deja `APP_HOST_IP=127.0.0.1`.
2. Instala y abre Docker Desktop.
3. Desde esta carpeta ejecuta `docker compose up --build -d`.

Compose construye el frontend, la API y MariaDB. Espera a que MariaDB esté disponible, aplica las migraciones, carga la semilla idempotente y finalmente inicia la API. La aplicación queda en `http://localhost:8080` y Swagger en `http://localhost:8080/api/documentacion`.

Para ver el inicio y los posibles errores: `docker compose logs -f`. Para detenerlo: `docker compose down`. Los datos de MariaDB quedan en el volumen `ag_mariadb_datos`; `docker compose down -v` los elimina deliberadamente.

En un VPS, establece `APP_HOST_IP=0.0.0.0`, `APP_PORT=80` (o el puerto elegido), `CORS_ORIGEN` con el dominio HTTPS público y secretos únicos. Después ejecuta el mismo `docker compose up --build -d`.

## Credenciales de demostración

Las credenciales de desarrollo están solamente en `backend/.env`, ignorado por Git. La Agencia inicial es `agencia_demo`; consulta ese archivo local para la contraseña. Antes de desplegar, se generarán secretos nuevos en el VPS y se cambiarán estas cuentas.

## Datos y migraciones

La base se llama `ag_loteria`. La aplicación utiliza `ag_aplicacion`, con permisos de uso normal; las migraciones usan `ag_migraciones`, con permisos DDL limitados a `ag_loteria`. No subas archivos `.env` ni valores de credenciales al repositorio.
