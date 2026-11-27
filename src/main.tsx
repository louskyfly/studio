import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// hors ligne : le service worker ne sert qu'en production
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
  })
}
