import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class ActualizarAgenciaDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  nombre_agencia?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  comision_porcentaje?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  cupo_animal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  jugada_minima?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  minutos_cierre?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  salto_linea?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @IsOptional()
  @IsUUID()
  fk_grupero?: string;
}
