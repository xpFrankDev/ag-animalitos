import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './compartido/i18n/configuracion';
import './app/estilos/global.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
