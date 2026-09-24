import { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Agencia, FormularioAgencia as DatosAgencia, Grupero, ModoFormulario, PermisosOperacion } from '../tipos';

type Propiedades = {
  modo: ModoFormulario;
  agencia: Agencia | null;
  formulario: DatosAgencia;
  permisos: PermisosOperacion;
  gruperos: Grupero[];
  guardando: boolean;
  liberando: boolean;
  alCambiar: (campo: keyof DatosAgencia, valor: string | boolean) => void;
  alCerrar: () => void;
  alGuardar: (evento: FormEvent) => void;
  alLiberarSerial: () => void;
};

/** Alta, edición y clonado de agencias. En edición permite liberar el equipo asignado. */
export function FormularioAgencia({
  modo,
  agencia,
  formulario,
  permisos,
  gruperos,
  guardando,
  liberando,
  alCambiar,
  alCerrar,
  alGuardar,
  alLiberarSerial,
}: Propiedades) {
  const { t } = useTranslation();
  const editando = modo === 'editar';
  const titulo = editando ? t('editar_agencia') : modo === 'clonar' ? t('clonar_agencia') : t('crear_agencia');

  return (
    <div className="fondo-consulta">
      <form className="ventana-consulta tarjeta formulario-agencia" onSubmit={alGuardar}>
        <header className="encabezado-consulta">
          <h2>{titulo}</h2>
          <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={alCerrar}>
            ×
          </button>
        </header>
        {modo === 'clonar' && agencia && (
          <p className="aviso-operacion">{t('clonar_agencia_aviso', { nombre: agencia.nombre_agencia })}</p>
        )}
        <div className="campos-agencia">
          {!editando && (
            <>
              <label>
                {t('codigo_agencia')}
                <input
                  value={formulario.codigo_agencia}
                  onChange={(evento) => alCambiar('codigo_agencia', evento.target.value.toUpperCase())}
                  placeholder="AG-002"
                  required
                />
              </label>
              <label>
                {t('usuario_acceso')}
                <input
                  value={formulario.nombre_usuario}
                  onChange={(evento) => alCambiar('nombre_usuario', evento.target.value)}
                  autoComplete="username"
                  required
                />
              </label>
              <label>
                {t('contrasena_inicial')}
                <input
                  type="password"
                  value={formulario.contrasena}
                  onChange={(evento) => alCambiar('contrasena', evento.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  required
                />
              </label>
            </>
          )}
          <label>
            {t('nombre_agencia')}
            <input value={formulario.nombre_agencia} onChange={(evento) => alCambiar('nombre_agencia', evento.target.value)} required />
          </label>
          {permisos.puede_definir_comision ? (
            <label>
              {t('comision_porcentaje')}
              <input
                type="number"
                min="0"
                max="100"
                step=".001"
                value={formulario.comision_porcentaje}
                onChange={(evento) => alCambiar('comision_porcentaje', evento.target.value)}
                required
              />
            </label>
          ) : (
            <p className="aviso-operacion">
              {t('comision_porcentaje')}: {formulario.comision_porcentaje}% · {t('comision_solo_banquero')}
            </p>
          )}
          <label>
            {t('cupo_animal')}
            <input
              type="number"
              min="1"
              step=".01"
              value={formulario.cupo_animal}
              onChange={(evento) => alCambiar('cupo_animal', evento.target.value)}
              required
            />
          </label>
          <label>
            {t('jugada_minima')}
            <input
              type="number"
              min="1"
              step=".01"
              value={formulario.jugada_minima}
              onChange={(evento) => alCambiar('jugada_minima', evento.target.value)}
              required
            />
          </label>
          <label>
            {t('minutos_cierre')}
            <input
              type="number"
              min="0"
              max="120"
              value={formulario.minutos_cierre}
              onChange={(evento) => alCambiar('minutos_cierre', evento.target.value)}
              required
            />
          </label>
          <label>
            {t('salto_linea')}
            <input
              type="number"
              min="0"
              max="10"
              value={formulario.salto_linea}
              onChange={(evento) => alCambiar('salto_linea', evento.target.value)}
              required
            />
            <small className="nota-campo">{t('salto_linea_descripcion')}</small>
          </label>
          {permisos.puede_gestionar_gruperos && (
            <label>
              {t('grupero_asignado')}
              <select value={formulario.fk_grupero} onChange={(evento) => alCambiar('fk_grupero', evento.target.value)}>
                <option value="">{t('sin_grupero')}</option>
                {gruperos
                  .filter((grupero) => grupero.activo || grupero.pk_grupero === formulario.fk_grupero)
                  .map((grupero) => (
                    <option key={grupero.pk_grupero} value={grupero.pk_grupero}>
                      {grupero.nombre_completo}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {editando && (
            <label className="campo-check">
              <input type="checkbox" checked={formulario.activa} onChange={(evento) => alCambiar('activa', evento.target.checked)} />{' '}
              {t('agencia_activa')}
            </label>
          )}
        </div>

        {editando && (
          <div className={agencia?.equipo_asignado ? 'liberar-serial' : 'liberar-serial sin-equipo'}>
            {agencia?.equipo_asignado ? (
              <>
                <span>
                  {t('equipo_asignado')}: <strong>{agencia.equipo}</strong>
                </span>
                <button type="button" className="boton-secundario" disabled={liberando} onClick={alLiberarSerial}>
                  {liberando ? t('liberando') : t('liberar_serial')}
                </button>
              </>
            ) : (
              <span>{t('liberar_serial_no_disponible')}</span>
            )}
          </div>
        )}

        <div className="acciones-modal">
          <button type="button" className="boton-secundario" onClick={alCerrar}>
            {t('cancelar')}
          </button>
          <button className="boton-primario" disabled={guardando}>
            {guardando ? t('guardando') : editando ? t('guardar_cambios') : t('crear_agencia')}
          </button>
        </div>
      </form>
    </div>
  );
}
