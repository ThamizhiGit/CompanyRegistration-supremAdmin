import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GraphQLProvider } from './providers/GraphQLProvider';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GraphQLProvider>
      <App />
    </GraphQLProvider>
  </StrictMode>,
);
