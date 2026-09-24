import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorApi, llamarApi } from '../../compartido/api/cliente';
import { fechaCaracas } from '../../compartido/utilidades/formato';
import type {
  Agencia,
  FormularioAgencia as DatosAgencia,
  FormularioGrupero as DatosGrupero,
  Grupero,
  Inicio,
  ModoFormulario,
  Vista,
} from './tipos';
import {
  formularioAgenciaClon,
  formularioAgenciaDeAgencia,
  formularioAgenciaVacio,
  formularioGruperoClon,
  formularioGruperoDeGrupero,
  formularioGruperoVacio,
} from './utilidades';
import { MenuOperacion } from './componentes/MenuOperacion';
import { ResumenOperacion } from './componentes/ResumenOperacion';
import { SeccionAgencias } from './componentes/SeccionAgencias';
import { SeccionGruperos } from './componentes/SeccionGruperos';
import { SeccionTickets } from './componentes/SeccionTickets';
import { SeccionResultados } from './componentes/SeccionResultados';
import { SeccionAccesos } from './componentes/SeccionAccesos';
import { FormularioAgencia } from './componentes/FormularioAgencia';
import { FormularioGrupero } from './componentes/FormularioGrupero';

type Propiedades = { token: string; alVencerSesion: () => void };

export function OperacionRuta({ token, alVencerSesion }: Propiedades) {
  const { t } = useTranslation();
  const hoy = fechaCaracas();
  const [inicio, establecerInicio] = useState<Inicio | null>(null);
  const [vista, establecerVista] = useState<Vista>('resumen');
  const [cargando, establecerCargando] = useState(true);
  const [mensaje, establecerMensaje] = useState('');
  const [desde, establecerDesde] = useState(hoy);
  const [hasta, establecerHasta] = useState(hoy);
  const [rangoAplicado, establecerRangoAplicado] = useState({ desde: hoy, hasta: hoy });

  const [modoAgencia, establecerModoAgencia] = useState<ModoFormulario | null>(null);
  const [agenciaReferencia, establecerAgenciaReferencia] = useState<Agencia | null>(null);
  const [formularioAgencia, establecerFormularioAgencia] = useState<DatosAgencia>(formularioAgenciaVacio);
  const [guardandoAgencia, establecerGuardandoAgencia] = useState(false);
  const [liberandoAgencia, establecerLiberandoAgencia] = useState(false);

  const [modoGrupero, establecerModoGrupero] = useState<ModoFormulario | null>(null);
  const [gruperoReferencia, establecerGruperoReferencia] = useState<Grupero | null>(null);
  const [formularioGrupero, establecerFormularioGrupero] = useState<DatosGrupero>(formularioGruperoVacio);
  const [guardandoGrupero, establecerGuardandoGrupero] = useState(false);

  useEffect(() => {
    if (!mensaje) return undefined;
    const temporizador = window.setTimeout(() => establecerMensaje(''), 4_000);
    return () => window.clearTimeout(temporizador);
  }, [mensaje]);

  const gestionarError = useCallback(
    (error: unknown) => {
      if (error instanceof ErrorApi && error.estado === 401) {
        alVencerSesion();
        return;
      }
      establecerMensaje(error instanceof Error ? error.message : t('error_generico'));
    },
    [alVencerSesion, t],
  );

  const cargar = useCallback(
    async (rango: { desde: string; hasta: string }) => {
      establecerCargando(true);
      try {
        establecerInicio(await llamarApi<Inicio>(`/operacion/inicio?${new URLSearchParams({ ...rango }).toString()}`, {}, token));
      } catch (error) {
        gestionarError(error);
      } finally {
        establecerCargando(false);
      }
    },
    [token, gestionarError],
  );

  useEffect(() => {
    void cargar(rangoAplicado);
  }, [cargar, rangoAplicado]);

  const permisos = inicio?.permisos;

  useEffect(() => {
    if (permisos && !permisos.puede_gestionar_gruperos && vista === 'gruperos') establecerVista('resumen');
  }, [permisos, vista]);

  const titulo = inicio?.perfil.tipo_usuario === 'BANQUERO' ? t('panel_banquero') : t('panel_grupero');

  function buscarRango(evento: FormEvent) {
    evento.preventDefault();
    if (desde > hasta) {
      establecerMensaje(t('error_consulta'));
      return;
    }
    const rango = { desde, hasta };
    establecerRangoAplicado(rango);
  }

  function abrirAgencia(agencia?: Agencia) {
    establecerModoAgencia(agencia ? 'editar' : 'crear');
    establecerAgenciaReferencia(agencia ?? null);
    establecerFormularioAgencia(agencia ? formularioAgenciaDeAgencia(agencia) : formularioAgenciaVacio());
  }

  function clonarAgencia(agencia: Agencia) {
    establecerModoAgencia('clonar');
    establecerAgenciaReferencia(agencia);
    establecerFormularioAgencia(formularioAgenciaClon(agencia));
  }

  function abrirGrupero(grupero?: Grupero) {
    establecerModoGrupero(grupero ? 'editar' : 'crear');
    establecerGruperoReferencia(grupero ?? null);
    establecerFormularioGrupero(grupero ? formularioGruperoDeGrupero(grupero) : formularioGruperoVacio());
  }

  function clonarGrupero(grupero: Grupero) {
    establecerModoGrupero('clonar');
    establecerGruperoReferencia(grupero);
    establecerFormularioGrupero(formularioGruperoClon(grupero));
  }

  function cambiarCampoAgencia(campo: keyof DatosAgencia, valor: string | boolean) {
    establecerFormularioAgencia((actual) => ({ ...actual, [campo]: valor }));
  }

  function cambiarCampoGrupero(campo: keyof DatosGrupero, valor: string | boolean) {
    establecerFormularioGrupero((actual) => ({ ...actual, [campo]: valor }));
  }

  async function guardarAgencia(evento: FormEvent) {
    evento.preventDefault();
    const editando = modoAgencia === 'editar' && agenciaReferencia;
    const datos = {
      nombre_agencia: formularioAgencia.nombre_agencia,
      cupo_animal: Number(formularioAgencia.cupo_animal),
      jugada_minima: Number(formularioAgencia.jugada_minima),
      minutos_cierre: Number(formularioAgencia.minutos_cierre),
      salto_linea: Number(formularioAgencia.salto_linea || 0),
      activa: formularioAgencia.activa,
      ...(permisos?.puede_definir_comision ? { comision_porcentaje: Number(formularioAgencia.comision_porcentaje) } : {}),
      ...(permisos?.puede_gestionar_gruperos ? { fk_grupero: formularioAgencia.fk_grupero || undefined } : {}),
    };
    if (!editando && (!formularioAgencia.codigo_agencia || !formularioAgencia.nombre_usuario || !formularioAgencia.contrasena)) {
      establecerMensaje(t('completar_agencia'));
      return;
    }
    establecerGuardandoAgencia(true);
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(
        editando ? `/operacion/agencias/${agenciaReferencia.pk_agencia}` : '/operacion/agencias',
        {
          method: editando ? 'PATCH' : 'POST',
          body: JSON.stringify(
            editando
              ? datos
              : {
                  ...datos,
                  codigo_agencia: formularioAgencia.codigo_agencia,
                  nombre_usuario: formularioAgencia.nombre_usuario,
                  contrasena: formularioAgencia.contrasena,
                },
          ),
        },
        token,
      );
      establecerMensaje(respuesta.mensaje);
      establecerModoAgencia(null);
      await cargar(rangoAplicado);
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerGuardandoAgencia(false);
    }
  }

  async function guardarGrupero(evento: FormEvent) {
    evento.preventDefault();
    const editando = modoGrupero === 'editar' && gruperoReferencia;
    if (!editando && (!formularioGrupero.nombre_completo || !formularioGrupero.nombre_usuario || !formularioGrupero.contrasena)) {
      establecerMensaje(t('completar_grupero'));
      return;
    }
    establecerGuardandoGrupero(true);
    try {
      const cuerpo = editando
        ? {
            nombre_completo: formularioGrupero.nombre_completo,
            cupo_animal: Number(formularioGrupero.cupo_animal),
            comision_porcentaje: Number(formularioGrupero.comision_porcentaje),
            activo: formularioGrupero.activo,
          }
        : {
            nombre_completo: formularioGrupero.nombre_completo,
            nombre_usuario: formularioGrupero.nombre_usuario,
            contrasena: formularioGrupero.contrasena,
            cupo_animal: Number(formularioGrupero.cupo_animal),
            comision_porcentaje: Number(formularioGrupero.comision_porcentaje),
          };
      const respuesta = await llamarApi<{ mensaje: string }>(
        editando ? `/operacion/gruperos/${gruperoReferencia.pk_grupero}` : '/operacion/gruperos',
        { method: editando ? 'PATCH' : 'POST', body: JSON.stringify(cuerpo) },
        token,
      );
      establecerMensaje(respuesta.mensaje);
      establecerModoGrupero(null);
      await cargar(rangoAplicado);
    } catch (error) {
      gestionarError(error);
    } finally {
      establecerGuardandoGrupero(false);
    }
  }

  async function liberarEquipo(agencia: Agencia) {
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/agencias/${agencia.pk_agencia}/liberar-serial`, { method: 'POST' }, token);
      establecerMensaje(respuesta.mensaje);
      if (agenciaReferencia?.pk_agencia === agencia.pk_agencia) {
        establecerAgenciaReferencia({ ...agenciaReferencia, equipo_asignado: false, equipo: null });
      }
      await cargar(rangoAplicado);
    } catch (error) {
      gestionarError(error);
    }
  }

  async function liberarSerialDesdeFormulario() {
    if (!agenciaReferencia) return;
    establecerLiberandoAgencia(true);
    try {
      await liberarEquipo(agenciaReferencia);
    } finally {
      establecerLiberandoAgencia(false);
    }
  }

  async function desactivarAgencia(agencia: Agencia) {
    if (!window.confirm(t('confirmar_desactivar_agencia', { nombre: agencia.nombre_agencia }))) return;
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/agencias/${agencia.pk_agencia}`, { method: 'DELETE' }, token);
      establecerMensaje(respuesta.mensaje);
      await cargar(rangoAplicado);
    } catch (error) {
      gestionarError(error);
    }
  }

  async function desactivarGrupero(grupero: Grupero) {
    if (!window.confirm(t('confirmar_desactivar_grupero', { nombre: grupero.nombre_completo }))) return;
    try {
      const respuesta = await llamarApi<{ mensaje: string }>(`/operacion/gruperos/${grupero.pk_grupero}`, { method: 'DELETE' }, token);
      establecerMensaje(respuesta.mensaje);
      await cargar(rangoAplicado);
    } catch (error) {
      gestionarError(error);
    }
  }

  if (cargando && !inicio) return <p className="estado-pagina">{t('cargando')}</p>;
  if (!inicio || !permisos) return <p className="estado-pagina mensaje-error">{mensaje || t('error_consulta')}</p>;

  return (
    <section className="operacion">
      <header className="encabezado-operacion">
        <div>
          <h1>{titulo}</h1>
          <p>{inicio.perfil.nombre_completo}</p>
        </div>
        <span>
          {inicio.resumen.agencias} {t('agencias')} · {inicio.resumen.tickets} {t('listado_tickets')}
        </span>
      </header>

      <div className="marco-operacion">
        <MenuOperacion
          vista={vista}
          permisos={permisos}
          conteos={{ agencias: inicio.agencias.length, gruperos: inicio.gruperos.length }}
          alCambiar={establecerVista}
        />

        <div className="contenido-operacion">
          {vista === 'resumen' && (
            <ResumenOperacion
              resumen={inicio.resumen}
              permisos={permisos}
              tipoUsuario={inicio.perfil.tipo_usuario}
              rango={rangoAplicado}
              desde={desde}
              hasta={hasta}
              cargando={cargando}
              alCambiarDesde={establecerDesde}
              alCambiarHasta={establecerHasta}
              alBuscar={buscarRango}
            />
          )}

          {vista === 'agencias' && (
            <SeccionAgencias
              agencias={inicio.agencias}
              permisos={permisos}
              alCrear={() => abrirAgencia()}
              alEditar={abrirAgencia}
              alClonar={clonarAgencia}
              alLiberar={(agencia) => void liberarEquipo(agencia)}
              alDesactivar={(agencia) => void desactivarAgencia(agencia)}
            />
          )}

          {vista === 'gruperos' && permisos.puede_gestionar_gruperos && (
            <SeccionGruperos
              gruperos={inicio.gruperos}
              alCrear={() => abrirGrupero()}
              alEditar={abrirGrupero}
              alClonar={clonarGrupero}
              alDesactivar={(grupero) => void desactivarGrupero(grupero)}
            />
          )}

          {vista === 'tickets' && (
            <SeccionTickets token={token} agencias={inicio.agencias} alVencerSesion={alVencerSesion} avisar={establecerMensaje} />
          )}

          {vista === 'resultados' && (
            <SeccionResultados
              token={token}
              permisos={permisos}
              alVencerSesion={alVencerSesion}
              avisar={establecerMensaje}
              reportarError={gestionarError}
            />
          )}

          {vista === 'accesos' && (
            <SeccionAccesos token={token} alVencerSesion={alVencerSesion} avisar={establecerMensaje} reportarError={gestionarError} />
          )}
        </div>
      </div>

      {mensaje && (
        <p className="notificacion emergente" role="status">
          {mensaje}
        </p>
      )}

      {modoAgencia && (
        <FormularioAgencia
          modo={modoAgencia}
          agencia={agenciaReferencia}
          formulario={formularioAgencia}
          permisos={permisos}
          gruperos={inicio.gruperos}
          guardando={guardandoAgencia}
          liberando={liberandoAgencia}
          alCambiar={cambiarCampoAgencia}
          alCerrar={() => establecerModoAgencia(null)}
          alGuardar={guardarAgencia}
          alLiberarSerial={() => void liberarSerialDesdeFormulario()}
        />
      )}

      {modoGrupero && (
        <FormularioGrupero
          modo={modoGrupero}
          grupero={gruperoReferencia}
          formulario={formularioGrupero}
          guardando={guardandoGrupero}
          alCambiar={cambiarCampoGrupero}
          alCerrar={() => establecerModoGrupero(null)}
          alGuardar={guardarGrupero}
        />
      )}
    </section>
  );
}
