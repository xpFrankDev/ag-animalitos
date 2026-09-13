import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TipoUsuario, Usuario } from '../base-datos/entidades';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto';

@Injectable()
export class AutenticacionService {
  constructor(
    @InjectRepository(Usuario) private readonly repositorioUsuarios: Repository<Usuario>,
    private readonly jwt: JwtService,
  ) {}

  async iniciarSesion(datos: IniciarSesionDto) {
    const usuario = await this.repositorioUsuarios
      .createQueryBuilder('usuario')
      .addSelect('usuario.hash_contrasena')
      .where('usuario.nombre_usuario = :nombre_usuario', { nombre_usuario: datos.nombre_usuario.trim() })
      .getOne();
    if (!usuario?.activo || !(await bcrypt.compare(datos.contrasena, usuario.hash_contrasena))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    const token = this.jwt.sign({ sub: usuario.pk_usuario, tipo_usuario: usuario.tipo_usuario, nombre_usuario: usuario.nombre_usuario });
    return { token, usuario: { pk_usuario: usuario.pk_usuario, nombre_usuario: usuario.nombre_usuario, nombre_completo: usuario.nombre_completo, tipo_usuario: usuario.tipo_usuario } };
  }

  validarAgencia(tipoUsuario: TipoUsuario): void {
    if (tipoUsuario !== TipoUsuario.AGENCIA) throw new UnauthorizedException('Este acceso corresponde únicamente a una Agencia.');
  }
}
