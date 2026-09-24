import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Los animales dejan de ser un catálogo único para la venta: cada sorteo declara la lista
 * (grupo) que participa en él. Los sorteos existentes quedan en el grupo «Clásico» con los
 * animales ya cargados; la semilla agrega después Guácharo Activo con su propio grupo.
 */
export class GruposDeAnimales1710000008000 implements MigrationInterface {
  name = 'GruposDeAnimales1710000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE grupos_animales (pk_grupo_animales int NOT NULL AUTO_INCREMENT, nombre varchar(50) NOT NULL, activo tinyint NOT NULL DEFAULT 1, modificado_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (pk_grupo_animales), UNIQUE KEY uq_grupos_animales_nombre (nombre)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE grupos_animales_animales (fk_grupo_animales int NOT NULL, fk_animal int NOT NULL, PRIMARY KEY (fk_grupo_animales,fk_animal), KEY ix_grupos_animales_animales_animal (fk_animal), CONSTRAINT fk_grupos_animales_animales_grupo FOREIGN KEY (fk_grupo_animales) REFERENCES grupos_animales(pk_grupo_animales) ON DELETE CASCADE, CONSTRAINT fk_grupos_animales_animales_animal FOREIGN KEY (fk_animal) REFERENCES animales(pk_animal)) ENGINE=InnoDB`,
    );
    await queryRunner.query('ALTER TABLE sorteos ADD COLUMN fk_grupo_animales int NULL AFTER nombre');

    await queryRunner.query("INSERT INTO grupos_animales (nombre) VALUES ('Clásico')");
    await queryRunner.query(
      `INSERT INTO grupos_animales_animales (fk_grupo_animales, fk_animal)
       SELECT (SELECT pk_grupo_animales FROM grupos_animales WHERE nombre = 'Clásico'), pk_animal FROM animales`,
    );
    await queryRunner.query(
      `UPDATE sorteos SET fk_grupo_animales = (SELECT pk_grupo_animales FROM grupos_animales WHERE nombre = 'Clásico') WHERE fk_grupo_animales IS NULL`,
    );

    await queryRunner.query('ALTER TABLE sorteos MODIFY fk_grupo_animales int NOT NULL');
    await queryRunner.query(
      'ALTER TABLE sorteos ADD CONSTRAINT fk_sorteos_grupo_animales FOREIGN KEY (fk_grupo_animales) REFERENCES grupos_animales(pk_grupo_animales)',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE sorteos DROP FOREIGN KEY fk_sorteos_grupo_animales');
    await queryRunner.query('ALTER TABLE sorteos DROP COLUMN fk_grupo_animales');
    await queryRunner.query('DROP TABLE grupos_animales_animales');
    await queryRunner.query('DROP TABLE grupos_animales');
  }
}
