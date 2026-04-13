/**
 * API client — all HTTP calls go through here.
 * Token is stored in sessionStorage under the key "pb_token".
 */

const queryApiBase = (() => {
  try {
    return new URLSearchParams(window.location.search).get("apiBase");
  } catch {
    return null;
  }
})();

const runtimeApiBase = (() => {
  try {
    return window.__PB_API_BASE__ || null;
  } catch {
    return null;
  }
})();

function defaultApiBase() {
  try {
    const { protocol, hostname } = window.location;
    if (hostname) return `${protocol}//${hostname}:8000`;
  } catch {}
  return "http://localhost:8000";
}

function normalizeBase(value) {
  const raw = String(value || "").trim();
  if (!raw) return defaultApiBase();
  return raw.replace(/\/+$/, "");
}

const BASE = normalizeBase(
  queryApiBase || runtimeApiBase || import.meta?.env?.VITE_API_URL || defaultApiBase()
);
const hasExplicitApiBase = Boolean(queryApiBase || runtimeApiBase || import.meta?.env?.VITE_API_URL);

function isLocalHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

function shouldBlockUnconfiguredProdOAuth(base) {
  let appHost = "";
  let apiHost = "";
  let apiPort = "";

  try {
    appHost = window.location.hostname;
  } catch {}

  try {
    const parsed = new URL(base);
    apiHost = parsed.hostname;
    apiPort = parsed.port;
  } catch {
    return false;
  }

  const runningLocally = isLocalHostname(appHost);
  const apiLooksLocal = isLocalHostname(apiHost);
  const defaultLocalPort = apiPort === "8000";

  // On production hosts, default localhost-style API settings will never work.
  return !runningLocally && !hasExplicitApiBase && (apiLooksLocal || defaultLocalPort);
}

function localFallbackBases(primaryBase) {
  let parsed;
  try {
    parsed = new URL(primaryBase);
  } catch {
    return [primaryBase];
  }

  const host = parsed.hostname;
  const port = parsed.port || "8000";
  const protocol = parsed.protocol || "http:";

  const candidates = [primaryBase];
  const add = (h) => {
    const candidate = `${protocol}//${h}:${port}`;
    if (!candidates.includes(candidate)) candidates.push(candidate);
  };

  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    add("localhost");
    add("127.0.0.1");
    add("0.0.0.0");
  }

  return candidates;
}

const API_BASE_CANDIDATES = queryApiBase ? [BASE] : localFallbackBases(BASE);
let activeBase = API_BASE_CANDIDATES[0];

function activeBaseOrigin() {
  try {
    return new URL(activeBase).origin;
  } catch {
    return window.location.origin;
  }
}

function configuredPublicOrigin() {
  try {
    const raw = window.__PB_PUBLIC_BASE__ || "";
    if (!raw) return null;
    return normalizeBase(raw);
  } catch {
    return null;
  }
}

function derivedPublicOriginFromApi() {
  try {
    const api = new URL(activeBaseOrigin());
    if (api.hostname.startsWith("api.")) {
      return `${api.protocol}//${api.hostname.slice(4)}`;
    }
    return api.origin;
  } catch {
    return activeBaseOrigin();
  }
}

// sessionStorage: cleared when the tab is closed (more secure than localStorage)
const TOKEN_KEY = "pb_token";

export const auth = {
  set: (token) => sessionStorage.setItem(TOKEN_KEY, token),
  get: () => sessionStorage.getItem(TOKEN_KEY),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
};

async function request(method, path, body = undefined) {
  const headers = { "Content-Type": "application/json" };
  const token = auth.get();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;

  const orderedBases = [activeBase, ...API_BASE_CANDIDATES.filter((b) => b !== activeBase)];
  for (const base of orderedBases) {
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      activeBase = base;
      break;
    } catch {
    }
  }

  if (!res) {
    throw new Error(
      `Could not reach API. Tried: ${orderedBases.join(", ")}. Check backend container and local networking.`
    );
  }

  if (res.status === 401) {
    auth.clear();
    window.location.hash = "/login";
    throw new Error("Session expired");
  }

  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`API error ${res.status}. Response was not valid JSON.`);
      }
    }
  }

  if (!res.ok) {
    const msg = json?.detail ?? `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.map((e) => e.msg).join(", ") : msg);
  }

  return json;
}

async function requestFormData(method, path, formData) {
  const token = auth.get();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res;

  const orderedBases = [activeBase, ...API_BASE_CANDIDATES.filter((b) => b !== activeBase)];
  for (const base of orderedBases) {
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: formData,
      });
      activeBase = base;
      break;
    } catch {
    }
  }

  if (!res) {
    throw new Error(
      `Could not reach API. Tried: ${orderedBases.join(", ")}. Check backend container and local networking.`
    );
  }

  if (res.status === 401) {
    auth.clear();
    window.location.hash = "/login";
    throw new Error("Session expired");
  }

  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`API error ${res.status}. Response was not valid JSON.`);
      }
    }
  }

  if (!res.ok) {
    const msg = json?.detail ?? `HTTP ${res.status}`;
    throw new Error(Array.isArray(msg) ? msg.map((e) => e.msg).join(", ") : msg);
  }

  return json;
}

export const api = {
  baseUrl: () => activeBase,

  /** Auth */
  me: () => request("GET", "/api/auth/me"),
  exchangeCode: (code) => request("GET", `/api/auth/exchange?code=${encodeURIComponent(code)}`),
  logout: () => request("POST", "/api/auth/logout"),

  /** Resume */
  uploadResume: (text) => request("POST", "/api/resume/upload", { text }),
  uploadResumePdf: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return requestFormData("POST", "/api/resume/pdf", formData);
  },
  getResume: () => request("GET", "/api/resume"),
  updateResumeJson: (resume_json) => request("PUT", "/api/resume/json", { resume_json }),

  /** Portfolio / slug */
  getSlug: () => request("GET", "/api/portfolio/slug"),
  setSlug: (slug, options = {}) =>
    request("PUT", "/api/portfolio/slug", { slug, ...options }),
  getSlugSuggestions: (slug) =>
    request("GET", `/api/portfolio/slug/suggestions?slug=${encodeURIComponent(slug)}`),

  /** Support / payments (PayNow MVP) */
  logPaynowSupport: (amount, currency = "SGD") =>
    request("POST", "/api/payments/log", { amount, currency }),

  /** OAuth redirect helpers (navigates away) */
  loginGithub: () => {
    if (shouldBlockUnconfiguredProdOAuth(activeBase)) {
      throw new Error(
        "API base is not configured for production. Open this app using ?apiBase=<your-api-url> or set window.__PB_API_BASE__ in config.js."
      );
    }
    window.location.href = `${activeBase}/api/auth/github`;
  },

  /** Public URL helpers */
  publicOrigin: () => configuredPublicOrigin() || derivedPublicOriginFromApi(),
};
