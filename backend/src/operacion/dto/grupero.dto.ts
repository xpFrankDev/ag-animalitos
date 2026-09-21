import { IsBoolean, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class CrearGruperoDto {
  @IsString()
  @Length(3, 120)
  nombre_completo!: string;

  @IsString()
  @Length(3, 50)
  nombre_usuario!: string;

  @IsString()
  @Length(6, 100)
  contrasena!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  cupo_animal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  comision_porcentaje?: number;
}

export class ActualizarGruperoDto {
  @IsOptional()
  @IsString()
  @Length(3, 120)
  nombre_completo?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  cupo_animal?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(100)
  comision_porcentaje?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
