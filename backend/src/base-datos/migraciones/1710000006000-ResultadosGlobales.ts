import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Los resultados provienen de fuentes públicas y los sorteos son compartidos, por lo que
 * dejan de pertenecer a un banquero. Se conserva el origen (automático o manual) y la
 * marca `aplicado_at` que usa el proceso de calificación de tickets.
 */
export class ResultadosGlobales1710000006000 implements MigrationInterface {
  name = 'ResultadosGlobales1710000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DELETE reciente FROM resultados reciente INNER JOIN resultados anterior ON reciente.fecha_juego = anterior.fecha_juego AND reciente.fk_horario_sorteo = anterior.fk_horario_sorteo AND reciente.pk_resultado > anterior.pk_resultado',
    );
    await queryRunner.query('ALTER TABLE resultados DROP FOREIGN KEY fk_resultados_banquero');
    await queryRunner.query('ALTER TABLE resultados DROP INDEX uq_resultados_banquero_horario_dia');
    await queryRunner.query('ALTER TABLE resultados DROP COLUMN fk_banquero');
    await queryRunner.query("ALTER TABLE resultados ADD COLUMN origen enum ('AUTOMATICO','MANUAL') NOT NULL DEFAULT 'AUTOMATICO' AFTER fk_animal");
    // Los resultados cargados antes de existir la recolección automática fueron manuales.
    await queryRunner.query("UPDATE resultados SET origen = 'MANUAL'");
    await queryRunner.query('ALTER TABLE resultados ADD COLUMN aplicado_at datetime NULL AFTER insertado_at');
    await queryRunner.query('ALTER TABLE resultados ADD UNIQUE KEY uq_resultados_horario_dia (fecha_juego,fk_horario_sorteo)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE resultados DROP INDEX uq_resultados_horario_dia');
    await queryRunner.query('ALTER TABLE resultados DROP COLUMN aplicado_at');
    await queryRunner.query('ALTER TABLE resultados DROP COLUMN origen');
    await queryRunner.query('ALTER TABLE resultados ADD COLUMN fk_banquero char(36) NULL AFTER fk_animal');
    await queryRunner.query('UPDATE resultados SET fk_banquero = fk_usuario_modificado WHERE fk_banquero IS NULL');
    await queryRunner.query('ALTER TABLE resultados ADD UNIQUE KEY uq_resultados_banquero_horario_dia (fecha_juego,fk_horario_sorteo,fk_banquero)');
  }
}
