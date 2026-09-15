import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class IniciarSesionDto {
  @ApiProperty({ example: 'agencia_demo' })
  @IsString()
  @Length(3, 50)
  nombre_usuario!: string;

  @ApiProperty({ example: 'CambiarEnEntornoLocal123!' })
  @IsString()
  @Length(8, 100)
  contrasena!: string;

  @ApiProperty({ example: 'ag-550e8400-e29b-41d4-a716-446655440000', required: false })
  @IsOptional()
  @IsString()
  @Length(12, 100)
  serial_dispositivo?: string;
}
