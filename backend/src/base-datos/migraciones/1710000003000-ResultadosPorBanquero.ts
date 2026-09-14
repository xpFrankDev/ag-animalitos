import { MigrationInterface, QueryRunner } from 'typeorm';

export class ResultadosPorBanquero1710000003000 implements MigrationInterface {
  name = 'ResultadosPorBanquero1710000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE resultados ADD COLUMN fk_banquero char(36) NULL AFTER fk_animal');
    await queryRunner.query('UPDATE resultados SET fk_banquero = fk_usuario_modificado WHERE fk_banquero IS NULL');
    await queryRunner.query('ALTER TABLE resultados MODIFY fk_banquero char(36) NOT NULL');
    await queryRunner.query('ALTER TABLE resultados DROP INDEX uq_resultados_horario_dia');
    await queryRunner.query('ALTER TABLE resultados ADD UNIQUE KEY uq_resultados_banquero_horario_dia (fecha_juego, fk_horario_sorteo, fk_banquero)');
    await queryRunner.query('ALTER TABLE resultados ADD CONSTRAINT fk_resultados_banquero FOREIGN KEY (fk_banquero) REFERENCES usuarios(pk_usuario)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE resultados DROP FOREIGN KEY fk_resultados_banquero');
    await queryRunner.query('ALTER TABLE resultados DROP INDEX uq_resultados_banquero_horario_dia');
    await queryRunner.query('ALTER TABLE resultados ADD UNIQUE KEY uq_resultados_horario_dia (fecha_juego, fk_horario_sorteo)');
    await queryRunner.query('ALTER TABLE resultados DROP COLUMN fk_banquero');
  }
}
