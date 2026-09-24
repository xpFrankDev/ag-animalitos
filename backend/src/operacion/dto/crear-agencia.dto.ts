import { IsInt, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';

export class CrearAgenciaDto {
  @IsString()
  @Length(2, 20)
  codigo_agencia!: string;

  @IsString()
  @Length(2, 120)
  nombre_agencia!: string;

  @IsString()
  @Length(3, 50)
  nombre_usuario!: string;

  @IsString()
  @Length(6, 100)
  contrasena!: string;

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
  @IsUUID()
  fk_grupero?: string;
}
