'use client';

import { useEffect } from 'react';

/**
 * Catches errors in the root layout itself — global-error.tsx replaces the
 * whole document (per Next's own constraint) and can't rely on providers,
 * theme context, or most app code, so this is deliberately minimal/inline-
 * styled rather than reusing shared components.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled root-layout error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: '1.5rem',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ maxWidth: '28rem', fontSize: '0.875rem', color: '#71717a' }}>
          An unexpected error occurred and the page could not be displayed.
          {error.digest && <> (ref: {error.digest})</>}
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.375rem',
            border: '1px solid #d4d4d8',
            background: '#18181b',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
