import { useTranslation } from 'react-i18next';
import type { PermisosOperacion, Vista } from '../tipos';

type Propiedades = {
  vista: Vista;
  permisos: PermisosOperacion;
  conteos: Partial<Record<Vista, number>>;
  alCambiar: (vista: Vista) => void;
};

const ICONOS: Record<Vista, string> = {
  resumen: '📊',
  agencias: '🏪',
  gruperos: '👥',
  tickets: '🎫',
  resultados: '🏁',
  accesos: '🔒',
};

/** Menú lateral con cada sub módulo interno del panel de Banquero/Grupero. */
export function MenuOperacion({ vista, permisos, conteos, alCambiar }: Propiedades) {
  const { t } = useTranslation();
  const secciones: { vista: Vista; etiqueta: string }[] = [
    { vista: 'resumen', etiqueta: t('resumen') },
    { vista: 'agencias', etiqueta: t('agencias') },
    ...(permisos.puede_gestionar_gruperos ? [{ vista: 'gruperos' as Vista, etiqueta: t('gruperos') }] : []),
    { vista: 'tickets', etiqueta: t('listado_tickets') },
    { vista: 'resultados', etiqueta: t('ver_resultados') },
    { vista: 'accesos', etiqueta: t('accesos') },
  ];

  return (
    <nav className="menu-operacion" aria-label={t('secciones_operacion')}>
      {secciones.map((seccion) => {
        const activo = vista === seccion.vista;
        return (
          <button
            key={seccion.vista}
            type="button"
            className={activo ? 'activo' : ''}
            aria-current={activo ? 'page' : undefined}
            onClick={() => alCambiar(seccion.vista)}
          >
            <span className="menu-icono" aria-hidden="true">
              {ICONOS[seccion.vista]}
            </span>
            <span>{seccion.etiqueta}</span>
            {conteos[seccion.vista] !== undefined && <small>{conteos[seccion.vista]}</small>}
          </button>
        );
      })}
    </nav>
  );
}
