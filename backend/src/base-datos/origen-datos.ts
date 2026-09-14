import 'dotenv/config';
import { DataSource } from 'typeorm';
import { entidades } from './entidades';
import { CrearEsquemaInicial1710000000000 } from './migraciones/1710000000000-CrearEsquemaInicial';
import { NormalizarCodigosAnimales1710000001000 } from './migraciones/1710000001000-NormalizarCodigosAnimales';

const esMigracion = process.env.TIPO_CONEXION === 'migraciones';

export const origenDatos = new DataSource({
  type: 'mariadb',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  username: esMigracion ? process.env.DB_MIGRACIONES_USUARIO : process.env.DB_APLICACION_USUARIO,
  password: esMigracion ? process.env.DB_MIGRACIONES_CONTRASENA : process.env.DB_APLICACION_CONTRASENA,
  database: process.env.DB_NOMBRE,
  entities: entidades,
  migrations: [CrearEsquemaInicial1710000000000, NormalizarCodigosAnimales1710000001000],
  synchronize: false,
  logging: false,
});
