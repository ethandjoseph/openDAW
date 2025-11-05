<!-- 5d7c6959-ea30-47bf-8834-def208bb3177 1ed930bc-e442-45e6-9d58-a95ec32c7737 -->
# Embed openDAW Studio inside a minimal Next.js app (via iframe)

## What already exists in Studio

- Studio runs on HTTPS at localhost:8080 and already sets COOP/COEP and CORP headers.
```39:50:/Users/ethandjoseph/Documents/GitHub/openDAW/packages/app/studio/vite.config.ts
server: {
    port: 8080,
    host: "localhost",
    https: command === "serve" ? {
        key: readFileSync(resolve(__dirname, "../../../certs/localhost-key.pem")),
        cert: readFileSync(resolve(__dirname, "../../../certs/localhost.pem"))
    } : undefined,
    headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "cross-origin"
    },
}
```

- Dev script:
```7:11:/Users/ethandjoseph/Documents/GitHub/openDAW/packages/app/studio/package.json
"scripts": {
  "dev": "vite --clearScreen false --host",
  "build": "tsc && vite build",
  "preview": "vite preview"
}
```


## HTTPS and cross-origin isolation in dev (IMPORTANT)

- On localhost, HTTPS is NOT required. http://localhost is a secure context. With COOP/COEP set on the Next app and COEP/CORP on Studio, SharedArrayBuffer and AudioWorklets work.
- You DO need HTTPS if using a non-localhost hostname (e.g., custom domain, LAN IP) or in production.
- Next dev over HTTPS is supported (recent versions): `next dev --experimental-https`. Otherwise use a local HTTPS proxy (Caddy/Nginx/Traefik or local-ssl-proxy with mkcert).
- It is fine for an HTTP parent (Next on localhost) to embed an HTTPS iframe (Studio). This is not mixed-content and will not be blocked.

## Minimal Next.js host app (TypeScript, App Router)

Create a new package `packages/app/host-next` with:

- `package.json` (Next 15+, React 18):
```json
{
  "name": "@opendaw/host-next",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.7.7",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0"
  }
}
```

- `next.config.js` (set COOP/COEP for cross-origin isolation):
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "Origin-Agent-Cluster", value: "?1" }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

- `.env.local` (optional for easy swapping):
```dotenv
NEXT_PUBLIC_STUDIO_URL=https://localhost:8080/
```

- `app/layout.tsx` (root layout):
```tsx
export const metadata = { title: "openDAW Host" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
```

- `app/components/HostStudio.tsx` (client component rendering the iframe):
```tsx
"use client";
import { useMemo } from "react";

export default function HostStudio() {
  const src = useMemo(() => process.env.NEXT_PUBLIC_STUDIO_URL || "https://localhost:8080/", [u]);
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <iframe
        title="openDAW Studio"
        src={src}
        style={{ width: "100%", height: "100%", border: 0 }}
        allow="autoplay; clipboard-read; clipboard-write; microphone; camera; fullscreen"
      />
    </div>
  );
}
```

- `app/page.tsx` (renders the client component only):
```tsx
import dynamic from "next/dynamic";
const HostStudio = dynamic(() => import("./components/HostStudio"), { ssr: false });
export default function Page() { return <HostStudio />; }
```


## Dev run flow

1) Start Studio (served with HTTPS, COOP/COEP already configured):

- From repo root: `pnpm --filter @opendaw/app-studio dev` (or `npm run dev` inside `packages/app/studio`).
- Ensure the referenced certs exist at `certs/localhost.pem` and `certs/localhost-key.pem` (or update paths).

2) Start Next host (localhost):

- For localhost only, HTTP is fine: `pnpm dev` → `http://localhost:3000`.
- If you prefer HTTPS in dev or need a non-localhost host, use: `next dev --experimental-https` (or a local HTTPS proxy).

3) Verify cross-origin isolation: open DevTools on the Next page and run `crossOriginIsolated` — it should be `true`. Also check AudioWorklet initialization inside the iframe.

## Notes

- SSR-safe: The Next app never imports Studio/browser-only code; it only embeds an iframe.
- COOP (top-level) + COEP (top-level and iframe) are satisfied: Next sets COOP/COEP; Studio sets COEP and CORP, enabling SAB use.
- HTTPS: Optional for `http://localhost` (secure context). Required for non-localhost or production. Embedding HTTPS Studio inside HTTP localhost Next is acceptable and not blocked.

### To-dos

- [x] Scaffold Next app in packages/app/host-next with TS and App Router
- [x] Add COOP/COEP headers via next.config.js for all routes
- [x] Create client component to render iframe to Studio URL
- [ ] Start Studio on 8080 and Next on 3000, wire env var
- [ ] Validate crossOriginIsolated and AudioWorklet init in browser