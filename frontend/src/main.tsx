import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { LocaleProvider } from './locale/LocaleContext';
import './styles/design-tokens.css';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';

const App = lazy(() => import('./App'));

function installNativeAppViewportGuards() {
  const blockPinchZoom = (event: Event) => {
    event.preventDefault();
  };

  document.addEventListener('gesturestart', blockPinchZoom, { passive: false });
  document.addEventListener('gesturechange', blockPinchZoom, { passive: false });
  document.addEventListener('gestureend', blockPinchZoom, { passive: false });

  const viewportContent =
    'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';

  const ensureViewport = () => {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      document.head.appendChild(meta);
    }
    if (meta.getAttribute('content') !== viewportContent) {
      meta.setAttribute('content', viewportContent);
    }
  };

  const lockDocumentWidth = () => {
    ensureViewport();
    document.documentElement.style.width = '100%';
    document.documentElement.style.maxWidth = '100%';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.width = '100%';
    document.body.style.maxWidth = '100%';
    document.body.style.overflowX = 'hidden';
  };

  lockDocumentWidth();
  window.addEventListener('resize', lockDocumentWidth);
  window.addEventListener('orientationchange', lockDocumentWidth);
}

installNativeAppViewportGuards();

async function prepareClientShell() {
  if (import.meta.env.DEV && 'serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    return;
  }

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Apply new bundles immediately to avoid repeated manual hard-refresh loops.
      void updateSW(true);
    },
  });
}

void prepareClientShell();

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
