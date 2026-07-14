import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { SharePage } from '@/components/SharePage'
import '@/styles/theme.css'
import App from './App.tsx'

// Tiny routing: /share/:token is the public read-only view (Fase 11),
// everything else is the app. No router library needed for two routes.
const shareMatch = window.location.pathname.match(/^\/share\/([a-f0-9]{16,64})\/?$/)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      {shareMatch ? <SharePage shareToken={shareMatch[1]} /> : <App />}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  </StrictMode>,
)
