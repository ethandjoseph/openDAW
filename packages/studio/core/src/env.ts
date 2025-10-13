// This works in both Vite and Next.js
const env = typeof window !== "undefined" && (import.meta as any).env
    ? (import.meta as any).env  // Vite (browser)
    : process.env               // Next.js (gets replaced at build time)

export const VITE_GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID as string
export const VITE_DROPBOX_CLIENT_ID = env.VITE_DROPBOX_CLIENT_ID as string
export const VITE_VJS_USE_LOCAL_SERVER = env.VITE_VJS_USE_LOCAL_SERVER as string
export const VITE_VJS_LOCAL_SERVER_URL = env.VITE_VJS_LOCAL_SERVER_URL as string
export const VITE_VJS_ONLINE_SERVER_URL = env.VITE_VJS_ONLINE_SERVER_URL as string