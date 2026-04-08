/**
 * SPA entry point.
 *
 * Hash-based routing:
 *   #/login            → login page
 *   #/dashboard        → home card for unified workflow
 *   #/dashboard/upload → upload step
 *   #/dashboard/slug   → slug/publish step
 *   #/dashboard/done   → published confirmation
 */

import { auth, api } from "./api.js";
import { renderLogin } from "./auth.js";
import { renderUpload, renderSlugConfig, renderPublished } from "./upload.js";

const app = document.getElementById("app");

const ROUTES = {
  root: "/",
  login: "/login",
  dashboard: "/dashboard",
  upload: "/dashboard/upload",
  slug: "/dashboard/slug",
  done: "/dashboard/done",
};

function getDashboardStep(path) {
  if (path.includes("/slug")) return "slug";
  if (path.includes("/done")) return "done";
  return "upload";
}

// ── Topbar ────────────────────────────────────────────────────────────────

let currentUser = null;

function renderTopbar(user) {
  return `
    <nav class="topbar">
      <a class="topbar__brand" href="#/dashboard">Portfolio Builder</a>
      <div class="topbar__user">
        ${user.avatar_url
          ? `<img class="topbar__avatar" src="${user.avatar_url}" alt="${user.name}" />`
          : ""}
        <span>${user.name || user.email || "Account"}</span>
        <button id="btn-signout" class="btn btn--ghost">Sign out</button>
      </div>
    </nav>
  `;
}

function attachSignOut() {
  document.getElementById("btn-signout")?.addEventListener("click", () => {
    api.logout().catch(() => {});
    auth.clear();
    currentUser = null;
    navigate(ROUTES.login);
  });
}

// ── Secure exchange-code callback ─────────────────────────────────────────
// OAuth callback redirects to #/callback?code=<one-time-30s-code>.
// We exchange that for a JWT via /api/auth/exchange.
// The hash fragment is never sent to the server, so the code never appears in logs.

async function handleCallbackCode() {
  const raw = window.location.hash;
  if (!raw.startsWith("#/callback")) return false;
  const match = raw.match(/[?&]code=([^&]+)/);
  if (!match) { navigate(ROUTES.login); return true; }
  try {
    const { token } = await api.exchangeCode(decodeURIComponent(match[1]));
    auth.set(token);
  } catch {
    navigate(ROUTES.login);
    return true;
  }
  navigate(ROUTES.dashboard);
  return true;
}

// ── Navigation ─────────────────────────────────────────────────────────────

function navigate(path) {
  window.location.hash = path;
}

function currentPath() {
  return window.location.hash.replace(/^#/, "").split("?")[0] || "/";
}

async function route() {
  if (await handleCallbackCode()) return;

  const path = currentPath();
  const token = auth.get();

  // Public routes
  if (!token || path === ROUTES.login) {
    if (token && path === ROUTES.root) {
      navigate(ROUTES.dashboard);
      return;
    }
    renderLogin(app);
    return;
  }

  // Fetch user if we don't have it yet
  if (!currentUser) {
    try {
      currentUser = await api.me();
    } catch {
      auth.clear();
      renderLogin(app);
      return;
    }
  }

  if (path === ROUTES.root || path === "") {
    navigate(ROUTES.dashboard);
    return;
  }

  if (path.startsWith("/dashboard")) {
    await renderDashboard(path);
    return;
  }

  // Fallback
  navigate(ROUTES.dashboard);
}

// ── Dashboard ──────────────────────────────────────────────────────────────

function stepEl(label, targetPath, isActive) {
  return `<button class="step ${isActive ? "active" : ""}" data-path="${targetPath}">${label}</button>`;
}

async function renderDashboard(path) {
  const topbar = renderTopbar(currentUser);

  // Homepage: single card, one unified workflow.
  if (path === ROUTES.dashboard || path === `${ROUTES.dashboard}/`) {
    const [resume, slugData] = await Promise.all([
      api.getResume().catch(() => null),
      api.getSlug().catch(() => ({ slug: null })),
    ]);

    const liveUrl = slugData.slug ? `${api.publicOrigin()}/${slugData.slug}/` : null;

    app.innerHTML = `
      ${topbar}
      <div class="dashboard dashboard-home">
        <div class="home-shell">
          <p class="home-kicker">Dashboard</p>
          <h2 class="home-title">Welcome back, ${currentUser.name || "there"}</h2>
          <p class="home-subtitle">Use one workflow to publish your first resume or update your existing one.</p>

          <div class="home-cards home-cards--single">
            <article class="home-card">
              <h3>${resume ? "Update Your Portfolio Resume" : "Publish Your Resume"}</h3>
              <p>${resume ? "Upload fresh resume text to update your portfolio and republish if needed." : "Upload resume text, parse it, and publish your portfolio URL."}</p>
              <button id="btn-home-workflow" class="home-card__action">${resume ? "Open Update Workflow" : "Start Publishing"}</button>
            </article>
          </div>

          ${liveUrl ? `
            <div class="home-live-url">
              <span>Your portfolio is live:</span>
              <a href="${liveUrl}" target="_blank" rel="noopener">${liveUrl}</a>
            </div>
          ` : ""}
        </div>
      </div>
    `;

    attachSignOut();
    document.getElementById("btn-home-workflow")?.addEventListener("click", () => navigate(ROUTES.upload));
    return;
  }

  const sub = getDashboardStep(path);

  app.innerHTML = `
    ${topbar}
    <div class="dashboard">
      <div class="steps">
        ${stepEl("1. Upload Resume", ROUTES.upload, sub === "upload")}
        ${stepEl("2. Publish", ROUTES.slug, sub === "slug")}
        ${stepEl("3. Done", ROUTES.done, sub === "done")}
      </div>
      <div id="step-content"></div>
    </div>
  `;

  attachSignOut();

  // Step navigation
  app.querySelectorAll(".step").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.path));
  });

  const stepContent = document.getElementById("step-content");

  if (sub === "upload") {
    renderUpload(stepContent, async () => {
      navigate(ROUTES.slug);
    });
  } else if (sub === "slug") {
    renderSlugConfig(stepContent, (slug, url) => {
      navigate(ROUTES.done);
      // Re-render done immediately without waiting for hashchange
      const sc = document.getElementById("step-content");
      if (sc) {
        renderPublished(sc, slug, url, {
          onChangeSlug: () => navigate(ROUTES.slug),
          onUploadAgain: () => navigate(ROUTES.upload),
        });
      }
    });
  } else if (sub === "done") {
    try {
      const [{ slug }, resume] = await Promise.all([
        api.getSlug(),
        api.getResume().catch(() => null),
      ]);

      if (slug) {
        renderPublished(stepContent, slug, `/${slug}/`, {
          onChangeSlug: () => navigate(ROUTES.slug),
          onUploadAgain: () => navigate(ROUTES.upload),
        });
        return;
      }

      // Keep Done tab available even before publishing.
      stepContent.innerHTML = `
        <div class="flow-shell">
          <div class="banner banner--error" style="margin-bottom:1rem;">Your portfolio is not live yet.</div>
          <h2>Step 3 — Done</h2>
          <p class="subtitle">Publish a slug to make your portfolio live at a public URL.</p>
          <button id="btn-go-publish" class="btn btn--primary" style="margin-right:.5rem;">Go to Publish</button>
          ${resume ? '<button id="btn-go-upload" class="btn btn--secondary">Upload new resume</button>' : '<button id="btn-go-upload" class="btn btn--secondary">Upload resume first</button>'}
        </div>
      `;

      stepContent.querySelector("#btn-go-publish")?.addEventListener("click", () => {
        navigate(ROUTES.slug);
      });
      stepContent.querySelector("#btn-go-upload")?.addEventListener("click", () => {
        navigate(ROUTES.upload);
      });
    } catch {
      stepContent.innerHTML = `
        <div class="banner banner--error">Could not load your publish status right now.</div>
      `;
    }
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

window.addEventListener("hashchange", route);
route();
