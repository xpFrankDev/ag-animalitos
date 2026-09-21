import { MigrationInterface, QueryRunner } from 'typeorm';

export class ControlAcceso1710000005000 implements MigrationInterface {
  name = 'ControlAcceso1710000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE control_acceso (pk_control_acceso char(36) NOT NULL, tipo enum ('USUARIO','IP','EQUIPO') NOT NULL, clave varchar(120) NOT NULL, intentos_fallidos smallint NOT NULL DEFAULT 0, bloqueos_consecutivos smallint NOT NULL DEFAULT 0, bloqueado_hasta datetime NULL, ultimo_intento_at datetime NULL, ultimo_bloqueo_at datetime NULL, modificado_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (pk_control_acceso), UNIQUE KEY uq_control_acceso_tipo_clave (tipo,clave)) ENGINE=InnoDB`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE control_acceso');
  }
}
