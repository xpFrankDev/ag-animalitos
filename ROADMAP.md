# ROADMAP · AG Animalitos

## Norte

Que una taquilla venezolana venda, cierre y pague su jornada sin descuadres, con
visibilidad completa para grupero y banquero y con resultados confiables.

## Principios

1. Correctitud antes que velocidad: ningún cálculo de dinero o cupo sin prueba.
2. Cero datos ficticios visibles al operador.
3. La operación se rige por la hora de Venezuela, sin importar dónde esté el servidor.
4. Local primero; el VPS se actualiza una sola vez y con confirmación explícita.

## Fase 0 · Estabilización — completada

- Fecha de juego, cierre de sorteos y numeración calculados en `America/Caracas`.
- Eliminación de tickets y resultados de demostración en la operación real.
- Multiplicador de premio por sorteo (base 30 para los sorteos actuales).
- Estados de ticket reales y calificación automática de premios.
- Paginación explícita con total en los listados de tickets.
- Swagger cerrado en producción y bloqueado en Nginx.
- Bloqueo de acceso por intentos fallidos, con liberación desde el panel.
- Permisos restrictivos de `.env`, respaldos verificados y verificación continua en CI.

## Fase 1 · Cierre operativo de la taquilla — en curso

- Numeración diaria por agencia y búsqueda de tickets por fecha y número.
- Impresión bloqueada cuando el servidor no responde: el cupo debe estar verificado.
- Control local del cupo por combinación, con verificación del servidor antes de imprimir.
- Pendiente: cierre de jornada imprimible con arqueo (vendido, premiado, comisión y neto).
- Pendiente: exportación del listado de tickets para contabilidad.

## Fase 2 · Gestión de la red — completada en su primera versión

- CRUD de agencias para Grupero (solo su grupo) y Banquero (toda su red).
- CRUD de gruperos para el Banquero, con cupo y comisión propios.
- Comisión variable definida por el banquero para cada agencia.
- Panel de accesos bloqueados con liberación de equipos.
- Pendiente: reporte de liquidación de comisiones por rango y por rol.

## Fase 3 · Resultados automáticos — en curso

- Resultados globales por sorteo y horario, sin dependencia de un banquero.
- Recolección automática cuatro veces por hora en horario venezolano.
- Calificación de tickets al aplicar cada resultado, incluida la corrección de un resultado.
- Pendiente: alertas cuando una fuente pública cambie de estructura.
- Pendiente: historial de conciliaciones entre resultado automático y manual.

## Fase 4 · Escala y operación avanzada

- Varias taquillas por agencia con numeración independiente.
- Permisos granulares por acción y auditoría de cambios por usuario.
- Métricas por agencia, grupero y banquero.
- Administración de sorteos, horarios y animales desde la interfaz.

## Fase 5 · Endurecimiento

- Rotación de secretos y revisión periódica de la superficie pública.
- Observabilidad: salud, errores y trazas por servicio.
- Pruebas de restauración de respaldos documentadas y ejecutadas.
- Runbook único de despliegue y reversión.

## Definición de terminado

- Cambios verificados en local: typecheck, lint, pruebas y build.
- Migración TypeORM versionada; nunca `synchronize`.
- Sin cadenas sin traducir ni datos ficticios.
- Controles nuevos con foco, vacío, error, carga y confirmación visibles.
- Nada se despliega al VPS sin confirmación explícita.
