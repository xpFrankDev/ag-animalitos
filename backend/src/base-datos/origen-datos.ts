import 'dotenv/config';
import { DataSource } from 'typeorm';
import { entidades } from './entidades';
import { CrearEsquemaInicial1710000000000 } from './migraciones/1710000000000-CrearEsquemaInicial';
import { ControlAcceso1710000005000 } from './migraciones/1710000005000-ControlAcceso';
import { BloqueoPermanente1710000007000 } from './migraciones/1710000007000-BloqueoPermanente';
import { NormalizarCodigosAnimales1710000001000 } from './migraciones/1710000001000-NormalizarCodigosAnimales';
import { CorregirAnimalesDuplicados1710000002000 } from './migraciones/1710000002000-CorregirAnimalesDuplicados';
import { GruposDeAnimales1710000008000 } from './migraciones/1710000008000-GruposDeAnimales';
import { PremioPorSorteoYNumeracionDiaria1710000004000 } from './migraciones/1710000004000-PremioPorSorteoYNumeracionDiaria';
import { ResultadosPorBanquero1710000003000 } from './migraciones/1710000003000-ResultadosPorBanquero';
import { ResultadosGlobales1710000006000 } from './migraciones/1710000006000-ResultadosGlobales';
import { SaltosDeLineaAgencia1710000009000 } from './migraciones/1710000009000-SaltosDeLineaAgencia';

const esMigracion = process.env.TIPO_CONEXION === 'migraciones';

export const origenDatos = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: esMigracion ? process.env.DB_MIGRACIONES_USUARIO : process.env.DB_APLICACION_USUARIO,
  password: esMigracion ? process.env.DB_MIGRACIONES_CONTRASENA : process.env.DB_APLICACION_CONTRASENA,
  database: process.env.DB_NOMBRE,
  entities: entidades,
  migrations: [
    CrearEsquemaInicial1710000000000,
    NormalizarCodigosAnimales1710000001000,
    CorregirAnimalesDuplicados1710000002000,
    ResultadosPorBanquero1710000003000,
    PremioPorSorteoYNumeracionDiaria1710000004000,
    ControlAcceso1710000005000,
    ResultadosGlobales1710000006000,
    BloqueoPermanente1710000007000,
    GruposDeAnimales1710000008000,
    SaltosDeLineaAgencia1710000009000,
  ],
  synchronize: false,
  logging: false,
});
