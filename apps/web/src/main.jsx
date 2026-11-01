import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'trust-ui-react/styles.css'
import './styles/global.css'
import { ThemeProvider } from 'trust-ui-react'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider defaultTheme="light">
      <App />
    </ThemeProvider>
  </StrictMode>,
)
