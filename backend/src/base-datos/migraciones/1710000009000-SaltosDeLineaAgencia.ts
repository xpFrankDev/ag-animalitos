import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Saltos de línea en blanco al final de la tirilla, configurables por agencia.
 * Se imprimen después del total y de la cantidad de jugadas; 0 deja la impresión como estaba.
 */
export class SaltosDeLineaAgencia1710000009000 implements MigrationInterface {
  name = 'SaltosDeLineaAgencia1710000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE agencias ADD COLUMN salto_linea smallint NOT NULL DEFAULT 0 AFTER minutos_cierre');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE agencias DROP COLUMN salto_linea');
  }
}
