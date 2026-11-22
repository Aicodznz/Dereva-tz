import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { installLeafletOfflineSupport } from './lib/leafletOfflinePatch';
import { installMapboxSafetyPatch } from './lib/mapboxSafetyPatch';
import './index.css';

installLeafletOfflineSupport();
installMapboxSafetyPatch();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
