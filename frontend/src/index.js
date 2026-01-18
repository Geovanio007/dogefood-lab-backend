import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for update detection and caching
serviceWorkerRegistration.register({
  onUpdate: (registration) => {
    console.log('[App] New version available!');
  },
  onSuccess: (registration) => {
    console.log('[App] Content cached for offline use.');
  }
});