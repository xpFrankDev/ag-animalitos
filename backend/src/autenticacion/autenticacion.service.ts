import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Agencia, TipoUsuario, Usuario } from '../base-datos/entidades';
import { IniciarSesionDto } from './dto/iniciar-sesion.dto';

@Injectable()
export class AutenticacionService {
  constructor(
    @InjectRepository(Usuario) private readonly repositorioUsuarios: Repository<Usuario>,
    @InjectRepository(Agencia) private readonly repositorioAgencias: Repository<Agencia>,
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
    if (usuario.tipo_usuario === TipoUsuario.AGENCIA) await this.validarDispositivoAgencia(usuario.pk_usuario, datos.serial_dispositivo);
    const token = this.jwt.sign({ sub: usuario.pk_usuario, tipo_usuario: usuario.tipo_usuario, nombre_usuario: usuario.nombre_usuario });
    return { token, vence_en: Date.now() + 10 * 60_000, usuario: { pk_usuario: usuario.pk_usuario, nombre_usuario: usuario.nombre_usuario, nombre_completo: usuario.nombre_completo, tipo_usuario: usuario.tipo_usuario } };
  }

  private async validarDispositivoAgencia(pkUsuario: string, serialDispositivo?: string): Promise<void> {
    if (!serialDispositivo) throw new UnauthorizedException('No se pudo validar el equipo de esta taquilla. Actualiza la aplicación e inténtalo de nuevo.');
    const agencia = await this.repositorioAgencias.findOne({ where: { fk_usuario: pkUsuario, activa: true } });
    if (!agencia) throw new UnauthorizedException('El usuario no tiene una Agencia activa asignada.');
    if (!agencia.serial_pc) {
      await this.repositorioAgencias.update(agencia.pk_agencia, { serial_pc: serialDispositivo });
      return;
    }
    if (agencia.serial_pc !== serialDispositivo) throw new UnauthorizedException('Esta taquilla está vinculada a otro equipo. Solicita al grupero o banquero liberar el equipo asignado.');
  }

  validarAgencia(tipoUsuario: TipoUsuario): void {
    if (tipoUsuario !== TipoUsuario.AGENCIA) throw new UnauthorizedException('Este acceso corresponde únicamente a una Agencia.');
  }
}
