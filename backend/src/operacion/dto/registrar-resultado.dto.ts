import { IsDateString, IsInt, Min } from 'class-validator';

export class RegistrarResultadoDto {
  @IsDateString()
  fecha_juego!: string;

  @IsInt()
  @Min(1)
  fk_horario_sorteo!: number;

  @IsInt()
  @Min(1)
  fk_animal!: number;
}
