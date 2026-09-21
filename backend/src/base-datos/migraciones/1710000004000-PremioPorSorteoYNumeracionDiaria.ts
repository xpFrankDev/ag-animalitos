import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El premio se define por sorteo (los existentes parten de 30) y la numeración de
 * tickets vuelve a 1 en cada jornada por agencia. Las actualizaciones automáticas
 * (por ejemplo la calificación de premios) no tienen usuario que las firme.
 */
export class PremioPorSorteoYNumeracionDiaria1710000004000 implements MigrationInterface {
  name = 'PremioPorSorteoYNumeracionDiaria1710000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE sorteos ADD COLUMN multiplicador_premio decimal(8,2) NOT NULL DEFAULT 30 AFTER nombre');
    await queryRunner.query('ALTER TABLE agencias ADD COLUMN fecha_numero_ticket date NULL AFTER proximo_numero_ticket');
    await queryRunner.query('ALTER TABLE tickets MODIFY fk_usuario_modificado char(36) NULL');
    await queryRunner.query('ALTER TABLE jugadas_ticket MODIFY fk_usuario_modificado char(36) NULL');
    await queryRunner.query('ALTER TABLE resultados MODIFY fk_usuario_modificado char(36) NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE resultados MODIFY fk_usuario_modificado char(36) NOT NULL');
    await queryRunner.query('ALTER TABLE jugadas_ticket MODIFY fk_usuario_modificado char(36) NOT NULL');
    await queryRunner.query('ALTER TABLE tickets MODIFY fk_usuario_modificado char(36) NOT NULL');
    await queryRunner.query('ALTER TABLE agencias DROP COLUMN fecha_numero_ticket');
    await queryRunner.query('ALTER TABLE sorteos DROP COLUMN multiplicador_premio');
  }
}
