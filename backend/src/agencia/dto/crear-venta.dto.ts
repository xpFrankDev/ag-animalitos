import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsPositive, ValidateNested } from 'class-validator';

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
