import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { getStored } from './lib/store'
import { DEFAULT_ACCENT, applyAccent } from './lib/theme'

applyAccent(getStored('ui:accent', DEFAULT_ACCENT))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
