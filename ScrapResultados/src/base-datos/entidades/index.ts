import { Animal } from './animal.entity';
import { HorarioSorteo } from './horario-sorteo.entity';
import { Resultado } from './resultado.entity';
import { Sorteo } from './sorteo.entity';

export * from './animal.entity';
export * from './sorteo.entity';
export * from './horario-sorteo.entity';
export * from './resultado.entity';

export const entidades = [Animal, Sorteo, HorarioSorteo, Resultado];
