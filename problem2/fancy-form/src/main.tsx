import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/app/styles/index.css'
import App from '@/app/App.tsx'
import { BrowserRouter } from 'react-router-dom'
import "@/shared/config/i18n/i18n"
import { Toaster } from 'sonner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position='top-center' />
    </BrowserRouter>
  </StrictMode>,
)
