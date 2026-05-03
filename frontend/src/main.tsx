import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

const App = lazy(() => import('./App'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense
      fallback={
        <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>載入 Safety App…</div>
      }
    >
      <App />
    </Suspense>
  </React.StrictMode>,
);
