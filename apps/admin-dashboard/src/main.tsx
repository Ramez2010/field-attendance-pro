import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { CompanyScopeProvider } from './context/CompanyScopeContext';
import { LanguageProvider } from './context/LanguageContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <CompanyScopeProvider>
            <App />
          </CompanyScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  </StrictMode>,
);
