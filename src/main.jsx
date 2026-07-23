import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import RouteEffects from './components/common/RouteEffects'
import AuthProvider from './features/auth/AuthProvider'
import './styles/tokens.css'
import './styles/global.css'
import './styles/components.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RouteEffects />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
