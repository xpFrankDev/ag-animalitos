import { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormularioGrupero as DatosGrupero, Grupero, ModoFormulario } from '../tipos';

type Propiedades = {
  modo: ModoFormulario;
  grupero: Grupero | null;
  formulario: DatosGrupero;
  guardando: boolean;
  alCambiar: (campo: keyof DatosGrupero, valor: string | boolean) => void;
  alCerrar: () => void;
  alGuardar: (evento: FormEvent) => void;
};

/** Alta, edición y clonado de gruperos de la red del banquero. */
export function FormularioGrupero({ modo, grupero, formulario, guardando, alCambiar, alCerrar, alGuardar }: Propiedades) {
  const { t } = useTranslation();
  const editando = modo === 'editar';
  const titulo = editando ? t('editar_grupero') : modo === 'clonar' ? t('clonar_grupero') : t('crear_grupero');

  return (
    <div className="fondo-consulta">
      <form className="ventana-consulta tarjeta formulario-agencia" onSubmit={alGuardar}>
        <header className="encabezado-consulta">
          <h2>{titulo}</h2>
          <button type="button" className="boton-cerrar" aria-label={t('cerrar')} onClick={alCerrar}>
            ×
          </button>
        </header>
        {modo === 'clonar' && grupero && (
          <p className="aviso-operacion">{t('clonar_grupero_aviso', { nombre: grupero.nombre_completo })}</p>
        )}
        <div className="campos-agencia">
          <label>
            {t('nombre_completo')}
            <input
              value={formulario.nombre_completo}
              onChange={(evento) => alCambiar('nombre_completo', evento.target.value)}
              required
            />
          </label>
          {!editando && (
            <>
              <label>
                {t('usuario_grupero')}
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
          {editando && (
            <label className="campo-check">
              <input type="checkbox" checked={formulario.activo} onChange={(evento) => alCambiar('activo', evento.target.checked)} />{' '}
              {t('activo')}
            </label>
          )}
        </div>
        <div className="acciones-modal">
          <button type="button" className="boton-secundario" onClick={alCerrar}>
            {t('cancelar')}
          </button>
          <button className="boton-primario" disabled={guardando}>
            {guardando ? t('guardando') : editando ? t('guardar_cambios') : t('crear_grupero')}
          </button>
        </div>
      </form>
    </div>
  );
}
