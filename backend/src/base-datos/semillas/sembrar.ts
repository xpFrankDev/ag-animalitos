import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Agencia, Animal, Grupero, HorarioSorteo, Sorteo, TipoUsuario, Usuario } from '../entidades';
import { origenDatos } from '../origen-datos';

const animales = [
  ['00', 'Ballena', '🐋'], ['0', 'Delfín', '🐬'], ['1', 'Carnero', '🐏'], ['2', 'Toro', '🐂'], ['3', 'Ciempiés', '🐛'], ['4', 'Alacrán', '🦂'], ['5', 'León', '🦁'], ['6', 'Rana', '🐸'], ['7', 'Perico', '🦜'], ['8', 'Ratón', '🐭'], ['9', 'Águila', '🦅'], ['10', 'Tigre', '🐯'], ['11', 'Gato', '🐈'], ['12', 'Caballo', '🐴'], ['13', 'Mono', '🐒'], ['14', 'Paloma', '🕊️'], ['15', 'Zorro', '🦊'], ['16', 'Oso', '🐻'], ['17', 'Pavo', '🦃'], ['18', 'Burro', '🐴'], ['19', 'Chivo', '🐐'], ['20', 'Cochino', '🐷'], ['21', 'Gallo', '🐓'], ['22', 'Camello', '🐫'], ['23', 'Cebra', '🦓'], ['24', 'Iguana', '🦎'], ['25', 'Gallina', '🐔'], ['26', 'Vaca', '🐄'], ['27', 'Perro', '🐶'], ['28', 'Zamuro', '🦅'], ['29', 'Elefante', '🐘'], ['30', 'Caimán', '🐊'], ['31', 'Lapa', '🐹'], ['32', 'Ardilla', '🐿️'], ['33', 'Pescado', '🐟'], ['34', 'Venado', '🦌'], ['35', 'Jirafa', '🦒'], ['36', 'Culebra', '🐍'],
] as const;

const MULTIPLICADOR_POR_DEFECTO = 30;
const sorteosConfigurados = [
  { nombre: 'Lotto Activo', minutos: 0, multiplicador_premio: MULTIPLICADOR_POR_DEFECTO },
  { nombre: 'La Granjita', minutos: 0, multiplicador_premio: MULTIPLICADOR_POR_DEFECTO },
  { nombre: 'Lotto Internacional', minutos: 30, multiplicador_premio: MULTIPLICADOR_POR_DEFECTO },
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

async function sembrarCatalogo(): Promise<void> {
  const repositorioAnimales = origenDatos.getRepository(Animal);
  for (const [codigo_animal, nombre, icono] of animales) {
    const existente = await repositorioAnimales.findOneBy({ codigo_animal });
    if (!existente) await repositorioAnimales.save(repositorioAnimales.create({ codigo_animal, nombre, icono, activo: true }));
    else if (codigo_animal === '18' && existente.icono !== icono) await repositorioAnimales.update(existente.pk_animal, { icono });
  }

  const repositorioSorteos = origenDatos.getRepository(Sorteo);
  const repositorioHorarios = origenDatos.getRepository(HorarioSorteo);
  for (const configuracion of sorteosConfigurados) {
    let sorteo = await repositorioSorteos.findOneBy({ nombre: configuracion.nombre });
    if (!sorteo) {
      sorteo = await repositorioSorteos.save(
        repositorioSorteos.create({ nombre: configuracion.nombre, multiplicador_premio: configuracion.multiplicador_premio.toFixed(2), activo: true }),
      );
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
