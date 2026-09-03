import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } })
const useHashRouter = import.meta.env.VITE_USE_HASH_ROUTER === 'true'
const app = <QueryClientProvider client={queryClient}><AuthProvider><App /></AuthProvider></QueryClientProvider>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {useHashRouter ? <HashRouter>{app}</HashRouter> : <BrowserRouter>{app}</BrowserRouter>}
  </StrictMode>,
)
