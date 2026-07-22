import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Both public and injected at build time — safe to read here.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const connectSrc = ["'self'", apiBaseUrl, supabaseUrl].filter(Boolean).join(" ");

// Next's dev server (HMR/Fast Refresh) needs 'unsafe-eval'; the production
// client bundle does not. Kept as loose as necessary, no looser.
const scriptSrc = isProd ? "'self' 'unsafe-inline'" : "'self' 'unsafe-inline' 'unsafe-eval'";

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  // shadcn/Tailwind rely on inline styles at runtime; no remote stylesheets.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  // The MRI viewer renders scan slices into worker-owned blobs.
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a lean production Docker image.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
