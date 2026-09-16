import { Agencia } from './agencia.entity';
import { Animal } from './animal.entity';
import { Grupero } from './grupero.entity';
import { HorarioSorteo } from './horario-sorteo.entity';
import { JugadaTicket } from './jugada-ticket.entity';
import { Resultado } from './resultado.entity';
import { Sorteo } from './sorteo.entity';
import { Ticket } from './ticket.entity';
import { Usuario } from './usuario.entity';

export * from './estados';
export * from './usuario.entity';
export * from './agencia.entity';
export * from './grupero.entity';
export * from './animal.entity';
export * from './sorteo.entity';
export * from './horario-sorteo.entity';
export * from './ticket.entity';
export * from './jugada-ticket.entity';
export * from './resultado.entity';

export const entidades = [Usuario, Grupero, Agencia, Animal, Sorteo, HorarioSorteo, Ticket, JugadaTicket, Resultado];
