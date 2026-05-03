import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { LocaleProvider } from './locale/LocaleContext';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

const App = lazy(() => import('./App'));

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Apply new bundles immediately to avoid repeated manual hard-refresh loops.
    void updateSW(true);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <Suspense
        fallback={
          <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
            載入 Safety App…
          </div>
        }
      >
        <App />
      </Suspense>
    </LocaleProvider>
  </React.StrictMode>,
);
