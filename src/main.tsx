import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { SecurityManager } from './utils/security';

// Validate environment variables at startup
const envValidation = SecurityManager.validateEnvironment();
if (!envValidation.isValid) {
  console.error('❌ Environment Configuration Error:');
  envValidation.errors.forEach(error => console.error(`  - ${error}`));
  console.error('\n💡 Please check your .env file and ensure all required variables are set.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
