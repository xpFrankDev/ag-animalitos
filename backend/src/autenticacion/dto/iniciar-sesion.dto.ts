import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class IniciarSesionDto {
  @ApiProperty({ example: 'agencia_demo' })
  @IsString()
  @Length(3, 50)
  nombre_usuario!: string;

  @ApiProperty({ example: 'CambiarEnEntornoLocal123!' })
  @IsString()
  @Length(8, 100)
  contrasena!: string;
}
