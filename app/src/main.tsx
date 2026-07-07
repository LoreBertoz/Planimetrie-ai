import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import '@/styles/theme.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  </StrictMode>,
)
