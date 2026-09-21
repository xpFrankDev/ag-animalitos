# ScrapResultados

Servicio NestJS independiente que consulta las fuentes públicas de resultados e inserta
únicamente los resultados nuevos. No expone API de negocio ni modifica tickets.

La calificación de premios la ejecuta la API principal: este servicio solo deja el
resultado con `aplicado_at` nulo para que la API lo tome y actualice los tickets del
horario correspondiente.

## Qué captura

- Lotto Activo: `https://www.lottoactivo.com/resultados/animalitos/YYYY-MM-DD/`
- Lotto Internacional: `https://www.lottoactivo.com/resultados/lotto_activo_internacional/YYYY-MM-DD/`
- La Granjita: `https://loteriadehoy.com/animalito/lagranjita/resultados/YYYY-MM-DD/`

La fecha se calcula en `America/Caracas`. De 08:00 a 19:59 consulta cuatro veces por hora
(`03, 17, 33 y 47`). Ambos valores se ajustan con `ZONA_HORARIA` y `EXPRESION_CRON`.

## Protección de los datos

- Los animales se normalizan al código canónico de AG: `1`, `01` y `Animal 1` se convierten en
  `1`, mientras que `00` (Ballena) se conserva distinto de `0` (Delfín).
- Las horas se convierten a `HH:mm:ss`, incluida la conversión AM/PM.
- Solo se acepta el rango de animales `0` a `36` y horarios existentes y activos en AG.
- Si la página cambia y no se reconoce ningún resultado válido, la fuente falla sin insertar nada.
- Los resultados son globales por día y horario: la restricción única de MariaDB y `INSERT IGNORE`
  hacen la operación idempotente y nunca reemplazan un resultado manual existente.
- Una segunda ejecución simultánea se omite para impedir carreras dentro del mismo proceso.

## Desarrollo local

1. Copia `.env.example` como `.env` y completa las credenciales de MariaDB.
2. Instala dependencias: `npm install`.
3. Ejecuta las comprobaciones: `npm test` y `npm run build`.
4. Inicia el proceso: `npm run dev`.

El endpoint de observación local es `GET http://localhost:3010/salud`; no dispara capturas
ni permite escribir resultados.

## Credenciales mínimas para producción

El usuario `scrap_resultados` debe tener acceso solo a la base de datos de AG: `SELECT` sobre
`animales`, `sorteos` y `horarios_sorteo`, y `SELECT, INSERT` sobre `resultados`. Este
repositorio no crea usuarios ni modifica la base de datos.

## Docker

El `Dockerfile` genera una imagen de producción y el servicio está incluido en el
`docker-compose.yml` raíz, a la espera de la ventana de despliegue acordada.
