/**
 * SPA entry point.
 *
 * Hash-based routing:
 *   #/login            → login page
 *   #/dashboard        → home card for unified workflow
 *   #/dashboard/upload → upload step
 *   #/dashboard/slug   → publish step (choose username + go live)
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
};

const escapeHtml = (v = "") =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

function safeHttpUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(String(value), window.location.origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {}
  return "";
}

function getDashboardStep(path) {
  if (path.includes("/slug") || path.includes("/done")) return "slug";
  return "upload";
}

// ── Topbar ────────────────────────────────────────────────────────────────

let currentUser = null;

function renderTopbar(user) {
  const displayName = escapeHtml(user.name || user.email || "Account");
  const safeAvatar = safeHttpUrl(user.avatar_url);
  return `
    <nav class="topbar">
      <a class="topbar__brand" href="#/dashboard">Portfolio Builder</a>
      <div class="topbar__user">
        <button id="btn-support-topbar" class="btn btn--support-topbar" title="Support this project" aria-label="Support this project">💛</button>
        ${safeAvatar
          ? `<img class="topbar__avatar" src="${escapeHtml(safeAvatar)}" alt="${displayName}" />`
          : ""}
        <span>${displayName}</span>
        <button id="btn-signout" class="btn btn--ghost">Sign out</button>
      </div>
    </nav>
    <div id="coffee-modal" class="modal modal--hidden">
      <div class="modal__overlay"></div>
      <div class="modal__content">
        <div class="modal__header">
          <h3>Support this project</h3>
          <button id="btn-close-modal" class="btn btn--ghost">✕</button>
        </div>
        <div class="modal__body">
          <p>If this app has been helpful, you can buy me a coffee via PayNow.</p>
          <p id="modal-thankyou" class="modal__thankyou" style="display:none;">Thank you for supporting this project 💛</p>
          <p class="modal__sgd-note">Supports SGD only at the moment.</p>
          <div id="qr-code" class="qr-code"></div>
          <p class="modal__hint">Scan the QR with your Singapore banking app (PayNow).</p>
          <p id="payee-verify" class="payee-verify" style="display:none;"></p>
        </div>
      </div>
    </div>
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

function attachCoffeeButton() {
  const modal = document.getElementById("coffee-modal");
  const closeBtn = document.getElementById("btn-close-modal");
  const overlay = modal?.querySelector(".modal__overlay");
  const thankYou = document.getElementById("modal-thankyou");

  app.querySelectorAll('[data-support-trigger="true"], #btn-support-topbar').forEach((btn) => {
    btn.addEventListener("click", () => {
      modal?.classList.remove("modal--hidden");
      if (thankYou) thankYou.style.display = "block";
      generatePayNowQR();
    });
  });

  closeBtn?.addEventListener("click", () => {
    modal?.classList.add("modal--hidden");
  });

  overlay?.addEventListener("click", () => {
    modal?.classList.add("modal--hidden");
  });
}

function generatePayNowQR() {
  const qrContainer = document.getElementById("qr-code");
  const payeeVerify = document.getElementById("payee-verify");
  if (!qrContainer) return;
  qrContainer.innerHTML = "";

  const payNowId = (window.__PAYNOW_ID__ || "").trim();
  const qrImageRaw = (window.__PAYNOW_QR_IMAGE__ || "assets/paynow-qr.png").trim();
  const qrImage = qrImageRaw
    ? (/^(https?:)?\/\//.test(qrImageRaw) || qrImageRaw.startsWith("/") ? qrImageRaw : `/${qrImageRaw}`)
    : "";
  const payeeName = (window.__PAYNOW_PAYEE_NAME__ || "").trim();

  if (payeeVerify && payeeName) {
    payeeVerify.style.display = "block";
    payeeVerify.textContent = `Verify payee name in your bank app: ${payeeName}`;
  }

  if (qrImage) {
    const img = document.createElement("img");
    img.src = qrImage;
    img.alt = "PayNow QR Code";
    img.className = "qr-image";
    img.onerror = () => {
      qrContainer.innerHTML = `<p class="modal__error">⚠️ Could not load PayNow QR image at ${qrImage}. Check config.js path and deployment assets.</p>`;
    };
    qrContainer.appendChild(img);
    return;
  }

  if (!payNowId || payNowId === "0123456789012") {
    qrContainer.innerHTML = `<p class="modal__error">⚠️ PayNow not configured. Set __PAYNOW_QR_IMAGE__ (preferred) or __PAYNOW_ID__ in config.js.</p>`;
    return;
  }

  // Generate PayNow QR static URL using SGQR standard
  // Dynamic QR: https://www.paypal.com/myaccount/transfer/send/
  // PayNow static: Fetch from NETS or generate client-side
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payNowId)}`;

  qrContainer.innerHTML = `
    <img src="${qrUrl}" alt="PayNow QR Code" class="qr-image" />
  `;
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
    await api.exchangeCode(decodeURIComponent(match[1]));
    auth.clear();
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

  if (!currentUser) {
    try {
      currentUser = await api.me();
    } catch {
      auth.clear();
      currentUser = null;
    }
  }

  if (!currentUser) {
    renderLogin(app);
    return;
  }

  if (path === ROUTES.login) {
    navigate(ROUTES.dashboard);
    return;
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

function metric(value = 0) {
  return Number(value || 0).toLocaleString();
}

function renderInsightsCards(payload) {
  const insights = payload?.insights;
  const analytics = payload?.analytics;

  if (!insights) {
    return `
      <section class="home-insights home-insights--empty">
        <h3>Portfolio Health</h3>
        <p>Upload a resume to generate your health score, missing checklist, and analytics dashboard.</p>
      </section>
    `;
  }

  const score = Number(insights.score || 0);
  const required = insights?.checklist?.required || [];
  const recommended = insights?.checklist?.recommended || [];
  const topChecklist = [...required, ...recommended].slice(0, 5);
  const totals = analytics?.totals || {};

  return `
    <section class="home-insights">
      <article class="home-insight-card home-insight-card--score">
        <p class="home-insight-kicker">Portfolio Health Score</p>
        <div class="home-score-wrap">
          <div class="home-score-value">${score}</div>
          <div class="home-score-meta">
            <div class="home-score-grade">Grade ${escapeHtml(insights.grade || "-")}</div>
            <div class="home-score-caption">Rule-based readiness score</div>
          </div>
        </div>
      </article>

      <article class="home-insight-card">
        <p class="home-insight-kicker">Missing Info Checklist</p>
        ${topChecklist.length ? `
          <ul class="home-checklist">
            ${topChecklist.map((item) => `<li>${escapeHtml(item.label || "")}</li>`).join("")}
          </ul>
        ` : `<p class="home-insight-empty">No major gaps detected. Great job.</p>`}
      </article>

      <article class="home-insight-card">
        <p class="home-insight-kicker">Analytics (Last 30 Days)</p>
        <div class="home-metrics-grid">
          <div><span>Views</span><strong>${metric(totals.views)}</strong></div>
          <div><span>Unique Visitors</span><strong>${metric(totals.unique_visitors)}</strong></div>
          <div><span>PDF Clicks</span><strong>${metric(totals.pdf_click)}</strong></div>
          <div><span>Profile Clicks</span><strong>${metric((totals.linkedin_click || 0) + (totals.github_click || 0))}</strong></div>
        </div>
      </article>
    </section>
  `;
}

async function renderDashboard(path) {
  const topbar = renderTopbar(currentUser);

  // Homepage: single card, one unified workflow.
  if (path === ROUTES.dashboard || path === `${ROUTES.dashboard}/`) {
    const [resume, slugData, insightsPayload] = await Promise.all([
      api.getResume().catch(() => null),
      api.getSlug().catch(() => ({ slug: null })),
      api.getPortfolioInsights().catch(() => null),
    ]);

    const liveUrl = slugData.slug ? `${api.publicOrigin()}/${slugData.slug}/` : null;
    const safeLiveUrl = safeHttpUrl(liveUrl);
    const safeCurrentUserName = escapeHtml(currentUser.name || "there");

    app.innerHTML = `
      ${topbar}
      <div class="dashboard dashboard-home">
        <div class="home-shell">
          <p class="home-kicker">Dashboard</p>
          <h2 class="home-title">Welcome back, ${safeCurrentUserName}</h2>
          <p class="home-subtitle">Use one workflow to publish your first resume or update your existing one.</p>

          <div class="home-cards">
            <article class="home-card">
              <h3>${resume ? "Update Your Portfolio Resume" : "Publish Your Resume"}</h3>
              <p>${resume ? "Upload fresh resume text to update your portfolio and republish if needed." : "Upload resume text, parse it, and publish your portfolio URL."}</p>
              <button id="btn-home-workflow" class="home-card__action">${resume ? "Open Update Workflow" : "Start Publishing"}</button>
            </article>
          </div>

          ${renderInsightsCards(insightsPayload)}

          ${safeLiveUrl ? `
            <div class="home-live-url">
              <span>Your portfolio is live:</span>
              <a href="${escapeHtml(safeLiveUrl)}" target="_blank" rel="noopener">${escapeHtml(safeLiveUrl)}</a>
            </div>
          ` : ""}
        </div>

      </div>
    `;

    attachSignOut();
    attachCoffeeButton();
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
      </div>
      <div id="step-content"></div>
    </div>
  `;

  attachSignOut();
  attachCoffeeButton();

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
      const sc = document.getElementById("step-content");
      if (sc) {
        renderPublished(sc, slug, url, {
          onChangeSlug: () => navigate(ROUTES.slug),
          onUploadAgain: () => navigate(ROUTES.upload),
        });
      }
    });
  }
}

// ── Bootstrap ──────────────────────────────────────────────────────────────

window.addEventListener("hashchange", route);
route();
