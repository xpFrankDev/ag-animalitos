import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizarCodigosAnimales1710000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE animales SET codigo_animal = LPAD(codigo_animal, 2, '0') WHERE codigo_animal IN ('1', '2', '3', '4', '5', '6', '7', '8', '9')");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE animales SET codigo_animal = CAST(CAST(codigo_animal AS UNSIGNED) AS CHAR) WHERE codigo_animal IN ('01', '02', '03', '04', '05', '06', '07', '08', '09')");
  }
}
