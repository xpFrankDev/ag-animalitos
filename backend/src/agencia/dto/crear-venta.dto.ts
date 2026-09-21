import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsPositive, IsString, Length, ValidateNested } from 'class-validator';

export class JugadaNuevaDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  fk_animal!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  fk_horario_sorteo!: number;

  @ApiProperty({ example: 10 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto!: number;
}

export class CrearVentaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => JugadaNuevaDto)
  jugadas!: JugadaNuevaDto[];
}

/** Comprobación previa a la impresión: cupo vigente o existencia del ticket emitido. */
export class ValidarVentaDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => JugadaNuevaDto)
  jugadas?: JugadaNuevaDto[];

  @IsOptional()
  @IsString()
  @Length(1, 24)
  serial?: string;
}
