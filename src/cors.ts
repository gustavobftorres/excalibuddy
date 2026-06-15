interface CorsEnv {
  FRONTEND_ORIGIN?: string;
}

const DEFAULT_ALLOWED_ORIGINS = [
  "https://excalibuddy.xyz",
  "https://excalidraw-buddy.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function isLocalDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]")
    );
  } catch {
    return false;
  }
}

export function getCorsHeaders(request: Request, env: CorsEnv): HeadersInit {
  const origin = request.headers.get("Origin");
  const allowedOrigins = new Set(
    [...DEFAULT_ALLOWED_ORIGINS, env.FRONTEND_ORIGIN].filter(Boolean)
  );

  if (!origin || (!allowedOrigins.has(origin) && !isLocalDevOrigin(origin))) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
