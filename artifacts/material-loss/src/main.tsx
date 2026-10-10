import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { isPresentationPath } from './presentation/route';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Separate document entry: no workspace gate, query client, auth hook, or
// business API module is mounted/imported by the presentation entry.
const App = lazy(() => isPresentationPath(window.location.pathname, import.meta.env.BASE_URL)
  ? import('./presentation/PresentationApp')
  : import('./App'));

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <Suspense fallback={<div role="status" className="p-6">…</div>}><App /></Suspense>
  </ErrorBoundary>,
);
