import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/source-sans-3'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontró el contenedor principal de la aplicación.')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
