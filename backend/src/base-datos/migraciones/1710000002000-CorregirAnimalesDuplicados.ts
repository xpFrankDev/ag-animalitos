import { MigrationInterface, QueryRunner } from 'typeorm';

export class CorregirAnimalesDuplicados1710000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const equivalencias = [['01', '1'], ['02', '2'], ['03', '3'], ['04', '4'], ['05', '5'], ['06', '6'], ['07', '7'], ['08', '8'], ['09', '9']];
    for (const [codigoDuplicado, codigoCanonico] of equivalencias) {
      await queryRunner.query('DELETE resultado_duplicado FROM resultados AS resultado_duplicado INNER JOIN animales AS animal_duplicado ON animal_duplicado.pk_animal = resultado_duplicado.fk_animal INNER JOIN animales AS animal_canonico ON animal_canonico.codigo_animal = ? INNER JOIN resultados AS resultado_canonico ON resultado_canonico.fecha_juego = resultado_duplicado.fecha_juego AND resultado_canonico.fk_horario_sorteo = resultado_duplicado.fk_horario_sorteo AND resultado_canonico.fk_animal = animal_canonico.pk_animal WHERE animal_duplicado.codigo_animal = ?', [codigoCanonico, codigoDuplicado]);
      await queryRunner.query('UPDATE jugadas_ticket AS jugada INNER JOIN animales AS animal_duplicado ON animal_duplicado.pk_animal = jugada.fk_animal INNER JOIN animales AS animal_canonico ON animal_canonico.codigo_animal = ? SET jugada.fk_animal = animal_canonico.pk_animal WHERE animal_duplicado.codigo_animal = ?', [codigoCanonico, codigoDuplicado]);
      await queryRunner.query('UPDATE resultados AS resultado INNER JOIN animales AS animal_duplicado ON animal_duplicado.pk_animal = resultado.fk_animal INNER JOIN animales AS animal_canonico ON animal_canonico.codigo_animal = ? SET resultado.fk_animal = animal_canonico.pk_animal WHERE animal_duplicado.codigo_animal = ?', [codigoCanonico, codigoDuplicado]);
      await queryRunner.query('DELETE animal_duplicado FROM animales AS animal_duplicado INNER JOIN animales AS animal_canonico ON animal_canonico.codigo_animal = ? WHERE animal_duplicado.codigo_animal = ?', [codigoCanonico, codigoDuplicado]);
    }
  }

  public async down(): Promise<void> {}
}
