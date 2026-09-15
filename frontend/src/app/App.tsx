import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sesion } from '../compartido/api/cliente';
import { InicioSesionRuta } from '../rutas/inicio-sesion/InicioSesionRuta';
import { AgenciaVentasRuta } from '../rutas/agencia-ventas/AgenciaVentasRuta';
import { ConsultaAgenciaRuta } from '../rutas/agencia-ventas/ConsultaAgenciaRuta';
import { OperacionRuta } from '../rutas/operacion/OperacionRuta';

const claveTema = 'ag_tema';
type RutaAnimalitos = '/animalitos/login' | '/animalitos/taquilla' | '/animalitos/grupero' | '/animalitos/banquero';

function rutaActual(): RutaAnimalitos {
  const ruta = window.location.pathname.replace(/\/$/, '');
  return ['/animalitos/login', '/animalitos/taquilla', '/animalitos/grupero', '/animalitos/banquero'].includes(ruta) ? ruta as RutaAnimalitos : '/animalitos/login';
}
function rutaPorTipo(tipo: string): RutaAnimalitos { return tipo === 'AGENCIA' ? '/animalitos/taquilla' : tipo === 'GRUPERO' ? '/animalitos/grupero' : '/animalitos/banquero'; }
function navegar(ruta: RutaAnimalitos, reemplazar = false) { window.history[reemplazar ? 'replaceState' : 'pushState']({}, '', ruta); window.dispatchEvent(new Event('ruta-animalitos')); }

export function App() {
  const { t, i18n } = useTranslation();
  const [sesion, establecerSesion] = useState<Sesion | null>(() => {
    const almacenada = localStorage.getItem('ag_sesion');
    return almacenada ? JSON.parse(almacenada) as Sesion : null;
  });
  const [tema, establecerTema] = useState(() => localStorage.getItem(claveTema) ?? 'claro');
  const [menuMovilAbierto, establecerMenuMovil] = useState(false);
  const [consultaAbierta, establecerConsulta] = useState<'resultados' | 'tickets' | 'resumen' | null>(null);
  const [ruta, establecerRuta] = useState<RutaAnimalitos>(rutaActual);

  useEffect(() => { document.documentElement.dataset.tema = tema; localStorage.setItem(claveTema, tema); }, [tema]);
  useEffect(() => { const actualizarRuta = () => establecerRuta(rutaActual()); window.addEventListener('popstate', actualizarRuta); window.addEventListener('ruta-animalitos', actualizarRuta); return () => { window.removeEventListener('popstate', actualizarRuta); window.removeEventListener('ruta-animalitos', actualizarRuta); }; }, []);
  useEffect(() => { if (window.location.pathname.replace(/\/$/, '') !== ruta) navegar(ruta, true); }, [ruta]);
  useEffect(() => { const destino = sesion ? rutaPorTipo(sesion.usuario.tipo_usuario) : '/animalitos/login'; if (ruta !== destino) navegar(destino, true); }, [sesion, ruta]);
  const cambiarIdioma = (idioma: string) => { void i18n.changeLanguage(idioma); localStorage.setItem('ag_idioma', idioma); };
  const salir = () => { localStorage.removeItem('ag_sesion'); establecerSesion(null); establecerMenuMovil(false); establecerConsulta(null); navegar('/animalitos/login', true); };
  useEffect(() => {
    if (!sesion) return undefined;
    const restante = sesion.vence_en - Date.now();
    if (restante <= 0) { salir(); return undefined; }
    const temporizador = window.setTimeout(salir, restante);
    return () => window.clearTimeout(temporizador);
  }, [sesion]);

  return <main>
    <header className="barra-superior">
      <div className="marca-con-menu"><div className="marca"><span>AG</span><small>animalitos</small></div>{sesion?.usuario.tipo_usuario === 'AGENCIA' && <><button className="boton-menu-movil" type="button" aria-expanded={menuMovilAbierto} aria-controls="menu-principal" onClick={() => establecerMenuMovil(!menuMovilAbierto)}>{t('menu')} <span aria-hidden="true">☰</span></button><nav id="menu-principal" className={`menu-principal ${menuMovilAbierto ? 'abierto' : ''}`} aria-label={t('navegacion_principal')}><button type="button" aria-current="page" onClick={() => establecerConsulta(null)}>{t('venta_animalitos')}</button><button type="button" onClick={() => establecerConsulta('resumen')}>{t('resumen_ventas')}</button><button type="button" onClick={() => establecerConsulta('resultados')}>{t('ver_resultados')}</button><button type="button" onClick={() => establecerConsulta('tickets')}>{t('listado_tickets')}</button></nav></>}</div>
      <div className="preferencias">
        <label className="control-idioma"><span>{t('idioma')}</span><select value={i18n.language} onChange={(evento) => cambiarIdioma(evento.target.value)}><option value="es">ES</option><option value="it">IT</option></select></label>
        <button className="boton-icono" type="button" aria-label={`${t('tema')}: ${tema === 'claro' ? t('oscuro') : t('claro')}`} onClick={() => establecerTema(tema === 'claro' ? 'oscuro' : 'claro')}>{tema === 'claro' ? '☀️' : '🌙'}</button>
        {sesion && <button className="boton-secundario" onClick={salir}>{t('salir')}</button>}
      </div>
    </header>
    {!sesion ? <InicioSesionRuta alIngresar={(nuevaSesion) => { localStorage.setItem('ag_sesion', JSON.stringify(nuevaSesion)); establecerSesion(nuevaSesion); navegar(rutaPorTipo(nuevaSesion.usuario.tipo_usuario), true); }} /> : sesion.usuario.tipo_usuario === 'AGENCIA' ? <><AgenciaVentasRuta token={sesion.token} alVencerSesion={salir} />{consultaAbierta && <ConsultaAgenciaRuta token={sesion.token} vista={consultaAbierta} alCerrar={() => establecerConsulta(null)} />}</> : <OperacionRuta token={sesion.token} alVencerSesion={salir} />}
  </main>;
}
