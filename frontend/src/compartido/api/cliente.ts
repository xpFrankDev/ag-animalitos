const URL_API = import.meta.env.VITE_API_URL ?? '/api';

export type Sesion = { token: string; usuario: { nombre_usuario: string; nombre_completo: string; tipo_usuario: string } };

export async function llamarApi<T>(ruta: string, opciones: RequestInit = {}, token?: string): Promise<T> {
  const respuesta = await fetch(`${URL_API}${ruta}`, { ...opciones, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opciones.headers } });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(datos.message?.toString() ?? 'No se pudo completar la operación.');
  return datos as T;
}

export const iniciarSesion = (nombre_usuario: string, contrasena: string) => llamarApi<Sesion>('/autenticacion/iniciar-sesion', { method: 'POST', body: JSON.stringify({ nombre_usuario, contrasena }) });
