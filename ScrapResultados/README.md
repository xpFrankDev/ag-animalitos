# ScrapResultados

Servicio NestJS independiente que consulta las fuentes públicas de resultados y escribe únicamente nuevos resultados en la base de datos de AG. No requiere ni expone una integración con la API principal.

## Qué captura

- Lotto Activo: `https://www.lottoactivo.com/resultados/animalitos/YYYY-MM-DD/`
- Lotto Internacional: `https://www.lottoactivo.com/resultados/lotto_activo_internacional/YYYY-MM-DD/`
- La Granjita: `https://loteriadehoy.com/animalito/lagranjita/resultados/YYYY-MM-DD/`

La fecha se calcula en `America/Caracas`. De 08:00 a 19:59 consulta cuatro veces por hora (`03, 17, 33 y 47`). Ambos valores se pueden ajustar con `ZONA_HORARIA` y `EXPRESION_CRON`.

## Protección de los datos

- Los animales se normalizan al código canónico de AG: `1`, `01` y `Animal 1` se convierten en `1`, mientras que `00` (Ballena) se conserva distinto de `0` (Delfín).
- Las horas se convierten a `HH:mm:ss`, incluida la conversión AM/PM.
- Solo se acepta el rango de animales `0` a `36` y horarios que existan y estén activos en AG.
- Si la página cambia y no se reconoce ningún resultado válido, el servicio falla esa fuente sin insertar nada.
- La restricción única de MariaDB y `INSERT IGNORE` hacen la operación idempotente: nunca duplica ni reemplaza un resultado manual ya existente.
- Una segunda ejecución simultánea se omite para impedir carreras dentro del mismo proceso.

## Desarrollo local

1. Copia `.env.example` como `.env` y completa las credenciales de MariaDB y `FK_BANQUERO`.
2. Instala dependencias: `npm install`.
3. Ejecuta las comprobaciones: `npm test` y `npm run build`.
4. Inicia el proceso: `npm run dev`.

El endpoint de observación local es `GET http://localhost:3010/salud`; no dispara capturas ni permite escribir resultados.

## Credenciales mínimas para producción

El usuario `scrap_resultados` debe tener acceso solo a la base de datos de AG: `SELECT` sobre `animales`, `sorteos` y `horarios_sorteo`, y `SELECT, INSERT` sobre `resultados`. Se configura en el despliegue conjunto; este repositorio no crea usuarios ni modifica la base de datos.

## Docker

El `Dockerfile` ya genera una imagen de producción. No se añadió todavía al `docker-compose.yml` raíz para respetar que el despliegue se hará después y coordinado con el otro servicio.
