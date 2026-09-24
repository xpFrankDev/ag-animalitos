import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Agencia, Animal, Grupero, GrupoAnimales, HorarioSorteo, Sorteo, TipoUsuario, Usuario } from '../entidades';
import { origenDatos } from '../origen-datos';

const animales = [
  ['00', 'Ballena', '🐋'], ['0', 'Delfín', '🐬'], ['1', 'Carnero', '🐏'], ['2', 'Toro', '🐂'], ['3', 'Ciempiés', '🐛'], ['4', 'Alacrán', '🦂'], ['5', 'León', '🦁'], ['6', 'Rana', '🐸'], ['7', 'Perico', '🦜'], ['8', 'Ratón', '🐭'], ['9', 'Águila', '🦅'], ['10', 'Tigre', '🐯'], ['11', 'Gato', '🐈'], ['12', 'Caballo', '🐴'], ['13', 'Mono', '🐒'], ['14', 'Paloma', '🕊️'], ['15', 'Zorro', '🦊'], ['16', 'Oso', '🐻'], ['17', 'Pavo', '🦃'], ['18', 'Burro', '🐴'], ['19', 'Chivo', '🐐'], ['20', 'Cochino', '🐷'], ['21', 'Gallo', '🐓'], ['22', 'Camello', '🐫'], ['23', 'Cebra', '🦓'], ['24', 'Iguana', '🦎'], ['25', 'Gallina', '🐔'], ['26', 'Vaca', '🐄'], ['27', 'Perro', '🐶'], ['28', 'Zamuro', '🦅'], ['29', 'Elefante', '🐘'], ['30', 'Caimán', '🐊'], ['31', 'Lapa', '🐹'], ['32', 'Ardilla', '🐿️'], ['33', 'Pescado', '🐟'], ['34', 'Venado', '🦌'], ['35', 'Jirafa', '🦒'], ['36', 'Culebra', '🐍'],
  // Guácharo Activo amplía la lista clásica hasta el 75 (Lotería del Oriente).
  ['37', 'Tortuga', '🐢'], ['38', 'Búfalo', '🐃'], ['39', 'Lechuza', '🦉'], ['40', 'Avispa', '🐝'], ['41', 'Canguro', '🦘'], ['42', 'Tucán', '🦜'], ['43', 'Mariposa', '🦋'], ['44', 'Chigüire', '🦫'], ['45', 'Garza', '🦢'], ['46', 'Puma', '🐆'], ['47', 'Pavo Real', '🦚'], ['48', 'Puercoespín', '🦔'], ['49', 'Pereza', '🦥'], ['50', 'Canario', '🐤'], ['51', 'Pelícano', '🦩'], ['52', 'Pulpo', '🐙'], ['53', 'Caracol', '🐌'], ['54', 'Grillo', '🦗'], ['55', 'Oso Hormiguero', '🐜'], ['56', 'Tiburón', '🦈'], ['57', 'Pato', '🦆'], ['58', 'Hormiga', '🐜'], ['59', 'Pantera', '🐅'], ['60', 'Camaleón', '🦎'], ['61', 'Panda', '🐼'], ['62', 'Cachicamo', '🦔'], ['63', 'Cangrejo', '🦀'], ['64', 'Gavilán', '🦅'], ['65', 'Araña', '🕷️'], ['66', 'Lobo', '🐺'], ['67', 'Avestruz', '🐦'], ['68', 'Jaguar', '🐆'], ['69', 'Conejo', '🐇'], ['70', 'Bisonte', '🦬'], ['71', 'Guacamaya', '🦜'], ['72', 'Gorila', '🦍'], ['73', 'Hipopótamo', '🦛'], ['74', 'Turpial', '🐦'], ['75', 'Guácharo', '🦇'],
] as const;

const MULTIPLICADOR_POR_DEFECTO = 30;
/** Guácharo Activo paga 60 por cada 1, el doble que los sorteos clásicos. */
const MULTIPLICADOR_GUACHARO = 60;
const CODIGO_MAXIMO_CLASICO = 36;
const codigosCatalogo = animales.map(([codigo]) => codigo);
const codigosClasicos = codigosCatalogo.filter((codigo) => Number(codigo) <= CODIGO_MAXIMO_CLASICO);
const codigosGuacharo = codigosCatalogo;

/**
 * Cada grupo es una lista de animales y cada sorteo declara a cuál pertenece. Guácharo
 * Activo usa su propia lista (hasta el 75), por eso no comparte tickets con los clásicos.
 */
const gruposAnimales = [
  { nombre: 'Clásico', codigos: codigosClasicos },
  { nombre: 'Guácharo', codigos: codigosGuacharo },
] as const;

const sorteosConfigurados = [
  { nombre: 'Lotto Activo', minutos: 0, multiplicador_premio: MULTIPLICADOR_POR_DEFECTO, grupo: 'Clásico' },
  { nombre: 'La Granjita', minutos: 0, multiplicador_premio: MULTIPLICADOR_POR_DEFECTO, grupo: 'Clásico' },
  { nombre: 'Lotto Internacional', minutos: 30, multiplicador_premio: MULTIPLICADOR_POR_DEFECTO, grupo: 'Clásico' },
  // Guácharo Activo sortea las mismas horas que Lotto Activo y La Granjita (08:00 a 19:00).
  { nombre: 'Guácharo Activo', minutos: 0, multiplicador_premio: MULTIPLICADOR_GUACHARO, grupo: 'Guácharo' },
];
const horasDeJornada = Array.from({ length: 12 }, (_, indice) => indice + 8);

async function obtenerOCrearUsuario(
  nombre_usuario: string,
  contrasena: string,
  tipo_usuario: TipoUsuario,
  nombre_completo: string,
): Promise<Usuario> {
  const repositorio = origenDatos.getRepository(Usuario);
  const existente = await repositorio.findOneBy({ nombre_usuario });
  if (existente) return existente;
  return repositorio.save(
    repositorio.create({
      pk_usuario: randomUUID(),
      nombre_usuario,
      nombre_completo,
      hash_contrasena: await bcrypt.hash(contrasena, 12),
      tipo_usuario,
      activo: true,
    }),
  );
}

/**
 * Crea los grupos y sincroniza sus listas con el catálogo: agregar un animal nuevo al
 * arreglo de `animales` alcanza para que su grupo quede actualizado en la próxima siembra.
 */
async function sembrarGruposAnimales(repositorioAnimales: Repository<Animal>): Promise<Map<string, GrupoAnimales>> {
  const repositorioGrupos = origenDatos.getRepository(GrupoAnimales);
  const catalogo = await repositorioAnimales.find();
  const porCodigo = new Map(catalogo.map((animal) => [animal.codigo_animal, animal]));
  const grupos = new Map<string, GrupoAnimales>();
  for (const configuracion of gruposAnimales) {
    let grupo = await repositorioGrupos.findOne({ where: { nombre: configuracion.nombre }, relations: { animales: true } });
    if (!grupo) grupo = await repositorioGrupos.save(repositorioGrupos.create({ nombre: configuracion.nombre, activo: true }));
    const esperados = configuracion.codigos.flatMap((codigo) => porCodigo.get(codigo) ?? []);
    const actuales = new Set((grupo.animales ?? []).map((animal) => animal.pk_animal));
    const faltantes = esperados.filter((animal) => !actuales.has(animal.pk_animal));
    if (faltantes.length) {
      grupo.animales = [...(grupo.animales ?? []), ...faltantes];
      grupo = await repositorioGrupos.save(grupo);
    }
    grupos.set(configuracion.nombre, grupo);
  }
  return grupos;
}

async function sembrarCatalogo(): Promise<void> {
  const repositorioAnimales = origenDatos.getRepository(Animal);
  for (const [codigo_animal, nombre, icono] of animales) {
    const existente = await repositorioAnimales.findOneBy({ codigo_animal });
    if (!existente) await repositorioAnimales.save(repositorioAnimales.create({ codigo_animal, nombre, icono, activo: true }));
    else if (codigo_animal === '18' && existente.icono !== icono) await repositorioAnimales.update(existente.pk_animal, { icono });
  }

  const grupos = await sembrarGruposAnimales(repositorioAnimales);
  const repositorioSorteos = origenDatos.getRepository(Sorteo);
  const repositorioHorarios = origenDatos.getRepository(HorarioSorteo);
  for (const configuracion of sorteosConfigurados) {
    const grupo = grupos.get(configuracion.grupo);
    if (!grupo) throw new Error(`Falta el grupo de animales «${configuracion.grupo}» para ${configuracion.nombre}.`);
    let sorteo = await repositorioSorteos.findOne({ where: { nombre: configuracion.nombre }, relations: { grupo_animales: true } });
    if (!sorteo) {
      sorteo = await repositorioSorteos.save(
        repositorioSorteos.create({
          nombre: configuracion.nombre,
          multiplicador_premio: configuracion.multiplicador_premio.toFixed(2),
          grupo_animales: grupo,
          activo: true,
        }),
      );
    } else if (sorteo.grupo_animales?.pk_grupo_animales !== grupo.pk_grupo_animales) {
      sorteo.grupo_animales = grupo;
      sorteo = await repositorioSorteos.save(sorteo);
    }
    for (const hora of horasDeJornada) {
      const valor = `${String(hora).padStart(2, '0')}:${String(configuracion.minutos).padStart(2, '0')}:00`;
      if (!(await repositorioHorarios.findOneBy({ fk_sorteo: sorteo.pk_sorteo, hora: valor }))) {
        await repositorioHorarios.save(repositorioHorarios.create({ fk_sorteo: sorteo.pk_sorteo, hora: valor, activo: true }));
      }
    }
  }
}

/**
 * Crea la cuenta raíz (banquero) a partir del entorno. Las cuentas de demostración solo
 * se crean si SEMILLA_DATOS_DEMO=true, para no instalar datos de prueba en producción.
 */
async function sembrarUsuariosIniciales(): Promise<void> {
  const usuarioBanquero = process.env.USUARIO_BANQUERO_INICIAL;
  const contrasenaBanquero = process.env.CONTRASENA_BANQUERO_INICIAL;
  if (!usuarioBanquero || !contrasenaBanquero) {
    throw new Error('Faltan USUARIO_BANQUERO_INICIAL y CONTRASENA_BANQUERO_INICIAL: son necesarios para crear la cuenta raíz.');
  }
  const banquero = await obtenerOCrearUsuario(usuarioBanquero, contrasenaBanquero, TipoUsuario.BANQUERO, process.env.NOMBRE_BANQUERO_INICIAL ?? 'Banquero');

  if (process.env.SEMILLA_DATOS_DEMO !== 'true') {
    console.log('Semilla aplicada: catálogo y cuenta raíz. Sin datos de demostración (SEMILLA_DATOS_DEMO != true).');
    return;
  }

  const gruperoUsuario = await obtenerOCrearUsuario(
    process.env.USUARIO_GRUPERO_INICIAL ?? 'grupero_demo',
    process.env.CONTRASENA_GRUPERO_INICIAL ?? 'CambiarEnEntornoLocal123!',
    TipoUsuario.GRUPERO,
    'Grupero demostración',
  );
  const agenciaUsuario = await obtenerOCrearUsuario(
    process.env.USUARIO_AGENCIA_INICIAL ?? 'agencia_demo',
    process.env.CONTRASENA_AGENCIA_INICIAL ?? 'CambiarEnEntornoLocal123!',
    TipoUsuario.AGENCIA,
    'Agencia demostración',
  );
  const repositorioGruperos = origenDatos.getRepository(Grupero);
  let grupero = await repositorioGruperos.findOneBy({ fk_usuario: gruperoUsuario.pk_usuario });
  if (!grupero) {
    grupero = await repositorioGruperos.save(
      repositorioGruperos.create({
        pk_grupero: randomUUID(),
        fk_usuario: gruperoUsuario.pk_usuario,
        fk_banquero: banquero.pk_usuario,
        cupo_animal: '500.00',
        comision_porcentaje: '3.000',
        activo: true,
        fk_usuario_modificado: banquero.pk_usuario,
      }),
    );
  }
  const repositorioAgencias = origenDatos.getRepository(Agencia);
  if (!(await repositorioAgencias.findOneBy({ fk_usuario: agenciaUsuario.pk_usuario }))) {
    await repositorioAgencias.save(
      repositorioAgencias.create({
        pk_agencia: randomUUID(),
        codigo_agencia: 'AG-001',
        nombre_agencia: 'Agencia demostración',
        comision_porcentaje: '12.000',
        cupo_animal: '100.00',
        jugada_minima: '1.00',
        minutos_cierre: 5,
        serial_pc: null,
        proximo_numero_ticket: 1,
        fecha_numero_ticket: null,
        fk_usuario: agenciaUsuario.pk_usuario,
        fk_banquero: banquero.pk_usuario,
        fk_grupero: grupero.pk_grupero,
        activa: true,
        fk_usuario_modificado: banquero.pk_usuario,
      }),
    );
  }
  console.log('Semilla aplicada con datos de demostración (SEMILLA_DATOS_DEMO=true).');
}

async function sembrar(): Promise<void> {
  await origenDatos.initialize();
  try {
    await sembrarCatalogo();
    await sembrarUsuariosIniciales();
    console.log('Semilla aplicada correctamente.');
  } finally {
    await origenDatos.destroy();
  }
}

void sembrar().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
