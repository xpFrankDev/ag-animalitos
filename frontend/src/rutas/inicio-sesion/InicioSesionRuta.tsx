import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { iniciarSesion, Sesion } from '../../compartido/api/cliente';

type Propiedades = { alIngresar: (sesion: Sesion) => void };

export function InicioSesionRuta({ alIngresar }: Propiedades) {
  const { t } = useTranslation();
  const [nombre_usuario, establecerUsuario] = useState('');
  const [contrasena, establecerContrasena] = useState('');
  const [error, establecerError] = useState('');
  const [enviando, establecerEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    establecerError('');
    establecerEnviando(true);
    try {
      alIngresar(await iniciarSesion(nombre_usuario, contrasena));
    } catch (causa) {
      establecerError(causa instanceof Error ? causa.message : t('error_sesion'));
    } finally {
      establecerEnviando(false);
    }
  }

  return <section className="contenedor-acceso"><form className="tarjeta acceso" onSubmit={enviar}>
    <div className="ilustracion">🐋 <span>00</span></div><h1>{t('acceso_agencia')}</h1><p>{t('iniciar_descripcion')}</p>
    <label>{t('usuario')}<input autoComplete="username" value={nombre_usuario} onChange={(evento) => establecerUsuario(evento.target.value)} required /></label>
    <label>{t('contrasena')}<input type="password" autoComplete="current-password" value={contrasena} onChange={(evento) => establecerContrasena(evento.target.value)} required /></label>
    {error && <p className="mensaje-error" role="alert">{error}</p>}
    <button className="boton-primario" disabled={enviando}>{enviando ? '…' : t('entrar')}</button>
  </form></section>;
}
