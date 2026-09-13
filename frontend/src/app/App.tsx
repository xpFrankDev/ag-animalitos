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

  useEffect(() => { document.documentElement.dataset.tema = tema; localStorage.setItem(claveTema, tema); }, [tema]);
  const cambiarIdioma = (idioma: string) => { void i18n.changeLanguage(idioma); localStorage.setItem('ag_idioma', idioma); };
  const salir = () => { localStorage.removeItem('ag_sesion'); establecerSesion(null); };

  return <main>
    <header className="barra-superior">
      <div className="marca"><span>AG</span><small>animalitos</small></div>
      <div className="preferencias">
        <label>{t('idioma')}<select value={i18n.language} onChange={(evento) => cambiarIdioma(evento.target.value)}><option value="es">ES</option><option value="it">IT</option></select></label>
        <label>{t('tema')}<button className="boton-secundario" onClick={() => establecerTema(tema === 'claro' ? 'oscuro' : 'claro')}>{tema === 'claro' ? '☀️' : '🌙'}</button></label>
        {sesion && <button className="boton-secundario" onClick={salir}>{t('salir')}</button>}
      </div>
    </header>
    {sesion ? <AgenciaVentasRuta token={sesion.token} usuario={sesion.usuario.nombre_completo} /> : <InicioSesionRuta alIngresar={(nuevaSesion) => { localStorage.setItem('ag_sesion', JSON.stringify(nuevaSesion)); establecerSesion(nuevaSesion); }} />}
  </main>;
}
