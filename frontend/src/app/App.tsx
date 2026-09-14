import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sesion } from '../compartido/api/cliente';
import { InicioSesionRuta } from '../rutas/inicio-sesion/InicioSesionRuta';
import { AgenciaVentasRuta } from '../rutas/agencia-ventas/AgenciaVentasRuta';

const claveTema = 'ag_tema';

export function App() {
  const { t, i18n } = useTranslation();
  const [sesion, establecerSesion] = useState<Sesion | null>(() => {
    const almacenada = localStorage.getItem('ag_sesion');
    return almacenada ? JSON.parse(almacenada) as Sesion : null;
  });
  const [tema, establecerTema] = useState(() => localStorage.getItem(claveTema) ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro'));
  const [menuMovilAbierto, establecerMenuMovil] = useState(false);

  useEffect(() => { document.documentElement.dataset.tema = tema; localStorage.setItem(claveTema, tema); }, [tema]);
  const cambiarIdioma = (idioma: string) => { void i18n.changeLanguage(idioma); localStorage.setItem('ag_idioma', idioma); };
  const salir = () => { localStorage.removeItem('ag_sesion'); establecerSesion(null); establecerMenuMovil(false); };

  return <main>
    <header className="barra-superior">
      <div className="marca-con-menu"><div className="marca"><span>AG</span><small>animalitos</small></div>{sesion && <><button className="boton-menu-movil" type="button" aria-expanded={menuMovilAbierto} aria-controls="menu-principal" onClick={() => establecerMenuMovil(!menuMovilAbierto)}>{t('menu')} <span aria-hidden="true">☰</span></button><nav id="menu-principal" className={`menu-principal ${menuMovilAbierto ? 'abierto' : ''}`} aria-label={t('navegacion_principal')}><button type="button" aria-current="page">{t('venta_animalitos')}</button><button type="button">{t('resumen_ventas')}</button><button type="button">{t('ver_resultados')}</button><button type="button">{t('listado_tickets')}</button></nav></>}</div>
      <div className="preferencias">
        <label className="control-idioma"><span>{t('idioma')}</span><select value={i18n.language} onChange={(evento) => cambiarIdioma(evento.target.value)}><option value="es">ES</option><option value="it">IT</option></select></label>
        <button className="boton-icono" type="button" aria-label={`${t('tema')}: ${tema === 'claro' ? t('oscuro') : t('claro')}`} onClick={() => establecerTema(tema === 'claro' ? 'oscuro' : 'claro')}>{tema === 'claro' ? '☀️' : '🌙'}</button>
        {sesion && <button className="boton-secundario" onClick={salir}>{t('salir')}</button>}
      </div>
    </header>
    {sesion ? <AgenciaVentasRuta token={sesion.token} alVencerSesion={salir} /> : <InicioSesionRuta alIngresar={(nuevaSesion) => { localStorage.setItem('ag_sesion', JSON.stringify(nuevaSesion)); establecerSesion(nuevaSesion); }} />}
  </main>;
}
