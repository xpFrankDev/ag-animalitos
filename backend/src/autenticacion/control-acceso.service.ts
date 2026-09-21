import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { In, LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import { ControlAcceso, TipoControlAcceso } from '../base-datos/entidades';

export type AlcanceAcceso = { tipo: TipoControlAcceso; clave: string };

export type LimitesAcceso = {
  intentosPermitidos: number;
  minutosBloqueo: number;
  bloqueosAntesDeBloqueoPermanente: number;
};

export function limitesAcceso(entorno: NodeJS.ProcessEnv = process.env): LimitesAcceso {
  return {
    intentosPermitidos: Number(entorno.ACCESO_INTENTOS_PERMITIDOS ?? 3),
    minutosBloqueo: Number(entorno.ACCESO_MINUTOS_BLOQUEO ?? 5),
    bloqueosAntesDeBloqueoPermanente: Number(entorno.ACCESO_BLOQUEOS_ANTES_DE_BLOQUEO_PERMANENTE ?? 3),
  };
}

export type EstadoIntentoFallido = {
  intentos_fallidos: number;
  bloqueos_consecutivos: number;
  bloqueado_hasta: Date | null;
  bloqueo_permanente: boolean;
};

/**
 * Aplica un intento fallido sobre un alcance: al llegar al límite de intentos bloquea
 * `minutosBloqueo`; cuando el alcance acumula `bloqueosAntesDeBloqueoPermanente` bloqueos,
 * el bloqueo deja de vencer solo y queda a cargo del grupero o banquero.
 */
export function aplicarIntentoFallido(
  control: Pick<ControlAcceso, 'intentos_fallidos' | 'bloqueos_consecutivos'>,
  limites: LimitesAcceso,
  ahora: Date = new Date(),
): EstadoIntentoFallido {
  const intentos = control.intentos_fallidos + 1;
  if (intentos < limites.intentosPermitidos) {
    return {
      intentos_fallidos: intentos,
      bloqueos_consecutivos: control.bloqueos_consecutivos,
      bloqueado_hasta: null,
      bloqueo_permanente: false,
    };
  }
  const bloqueos = control.bloqueos_consecutivos + 1;
  const permanente = bloqueos >= limites.bloqueosAntesDeBloqueoPermanente;
  return {
    intentos_fallidos: 0,
    bloqueos_consecutivos: bloqueos,
    bloqueado_hasta: permanente ? null : new Date(ahora.getTime() + limites.minutosBloqueo * 60_000),
    bloqueo_permanente: permanente,
  };
}

/** Cada intento se controla por usuario, por IP y por equipo. */
export function construirAlcancesAcceso(nombreUsuario: string, ip: string, serialEquipo?: string): AlcanceAcceso[] {
  const alcances: AlcanceAcceso[] = [
    { tipo: TipoControlAcceso.USUARIO, clave: nombreUsuario.trim().toLowerCase() },
    { tipo: TipoControlAcceso.IP, clave: ip },
  ];
  if (serialEquipo?.trim()) alcances.push({ tipo: TipoControlAcceso.EQUIPO, clave: serialEquipo.trim() });
  return alcances.filter((alcance) => alcance.clave.length > 0);
}

@Injectable()
export class ControlAccesoService {
  constructor(@InjectRepository(ControlAcceso) private readonly controles: Repository<ControlAcceso>) {}

  private async obtenerOCrear(alcance: AlcanceAcceso): Promise<ControlAcceso> {
    const existente = await this.controles.findOneBy({ tipo: alcance.tipo, clave: alcance.clave });
    if (existente) return existente;
    return this.controles.save(this.controles.create({
      pk_control_acceso: randomUUID(),
      tipo: alcance.tipo,
      clave: alcance.clave,
      intentos_fallidos: 0,
      bloqueos_consecutivos: 0,
      bloqueado_hasta: null,
      bloqueo_permanente: false,
      ultimo_intento_at: null,
      ultimo_bloqueo_at: null,
    }));
  }

  /** Impide continuar si el usuario, la IP o el equipo están bloqueados. */
  async verificar(alcances: AlcanceAcceso[]): Promise<void> {
    const ahora = new Date();
    const bloqueados = await this.controles.find({
      where: alcances.flatMap((alcance) => [
        { tipo: alcance.tipo, clave: alcance.clave, bloqueo_permanente: true },
        { tipo: alcance.tipo, clave: alcance.clave, bloqueado_hasta: MoreThan(ahora) },
      ]),
    });
    if (!bloqueados.length) return;
    if (bloqueados.some((control) => control.bloqueo_permanente)) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Tu acceso quedó bloqueado de forma permanente por intentos fallidos. Pídele a tu grupero o a tu banquero que libere el usuario o el equipo.',
          permanente: true,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const hasta = bloqueados.reduce<Date>(
      (mayor, control) => (control.bloqueado_hasta! > mayor ? control.bloqueado_hasta! : mayor),
      bloqueados[0].bloqueado_hasta!,
    );
    const restante = Math.max(1, Math.ceil((hasta.getTime() - Date.now()) / 60_000));
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: `Acceso bloqueado por intentos fallidos. Podrás volver a intentarlo en ${restante} minuto(s) o solicita la liberación a tu grupero o banquero.`,
        reintentar_en_minutos: restante,
        permanente: false,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  async registrarFallo(alcances: AlcanceAcceso[]): Promise<void> {
    const limites = limitesAcceso();
    const ahora = new Date();
    for (const alcance of alcances) {
      const control = await this.obtenerOCrear(alcance);
      const estado = aplicarIntentoFallido(control, limites, ahora);
      await this.controles.update(control.pk_control_acceso, {
        ...estado,
        ultimo_intento_at: ahora,
        ...(estado.bloqueo_permanente || estado.bloqueado_hasta ? { ultimo_bloqueo_at: ahora } : {}),
      });
    }
  }

  /** Un acceso correcto reinicia el ciclo: intentos y bloqueos consecutivos vuelven a cero. */
  async registrarExito(alcances: AlcanceAcceso[]): Promise<void> {
    const ahora = new Date();
    for (const alcance of alcances) {
      await this.controles.update(
        { tipo: alcance.tipo, clave: alcance.clave },
        { intentos_fallidos: 0, bloqueos_consecutivos: 0, bloqueado_hasta: null, bloqueo_permanente: false, ultimo_intento_at: ahora },
      );
    }
  }

  async listarBloqueados(claves: { usuarios: string[]; equipos: string[] }): Promise<ControlAcceso[]> {
    const condiciones = [];
    if (claves.usuarios.length) condiciones.push({ tipo: TipoControlAcceso.USUARIO, clave: In(claves.usuarios) });
    if (claves.equipos.length) condiciones.push({ tipo: TipoControlAcceso.EQUIPO, clave: In(claves.equipos) });
    if (!condiciones.length) return [];
    const candidatos = await this.controles.find({ where: condiciones });
    return candidatos
      .filter((control) => control.bloqueo_permanente || control.bloqueado_hasta)
      .sort((izquierda, derecha) => {
        if (izquierda.bloqueo_permanente !== derecha.bloqueo_permanente) return izquierda.bloqueo_permanente ? -1 : 1;
        return (derecha.bloqueado_hasta?.getTime() ?? 0) - (izquierda.bloqueado_hasta?.getTime() ?? 0);
      });
  }

  async desbloquear(pkControlAcceso: string): Promise<boolean> {
    const resultado = await this.controles.update(
      { pk_control_acceso: pkControlAcceso },
      { intentos_fallidos: 0, bloqueos_consecutivos: 0, bloqueado_hasta: null, bloqueo_permanente: false },
    );
    return Boolean(resultado.affected);
  }

  /** Limpieza de registros antiguos que ya no representan riesgo. */
  async limpiarExpirados(diasRetencion = 30): Promise<number> {
    const limite = new Date(Date.now() - diasRetencion * 24 * 60 * 60_000);
    const resultado = await this.controles.delete({
      bloqueado_hasta: LessThanOrEqual(limite),
      ultimo_intento_at: LessThanOrEqual(limite),
    });
    return resultado.affected ?? 0;
  }
}
