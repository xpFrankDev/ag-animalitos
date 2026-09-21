import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El tercer bloqueo consecutivo de un mismo alcance (usuario, IP o equipo) deja de ser
 * temporal: queda vigente hasta que el grupero o el banquero lo libere desde el panel.
 */
export class BloqueoPermanente1710000007000 implements MigrationInterface {
  name = 'BloqueoPermanente1710000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE control_acceso ADD COLUMN bloqueo_permanente tinyint(1) NOT NULL DEFAULT 0 AFTER bloqueado_hasta',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE control_acceso DROP COLUMN bloqueo_permanente');
  }
}
