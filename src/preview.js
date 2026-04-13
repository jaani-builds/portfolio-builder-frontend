const app = document.getElementById("app");

function esc(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function asList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return '<p class="muted-small">No items</p>';
  }
  return `<ul class="inline-list">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function link(url, label) {
  if (!url) return "";
  const safe = esc(url);
  return `<a href="${safe}" target="_blank" rel="noopener">${esc(label || url)}</a>`;
}

function renderExperience(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<p class="muted-small">No experience added yet.</p>';
  }

  return entries.map((entry) => {
    const title = esc(entry?.title || "Untitled role");
    const company = esc(entry?.company || "");
    const location = esc(entry?.location || "");
    const start = esc(entry?.start || "");
    const end = esc(entry?.end || "");
    const period = [start, end].filter(Boolean).join(" - ");
    const highlights = asList(entry?.highlights || []);

    return `
      <article class="role-item">
        <div class="role-top">
          <div>
            <h3>${title}${company ? ` at ${company}` : ""}</h3>
            ${location ? `<p class="muted-small">${location}</p>` : ""}
          </div>
          ${period ? `<p class="muted-small">${period}</p>` : ""}
        </div>
        ${highlights}
      </article>
    `;
  }).join("");
}

function renderEducation(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    return '<p class="muted-small">No education added yet.</p>';
  }

  return entries.map((entry) => {
    const degree = esc(entry?.degree || "");
    const school = esc(entry?.school || "");
    const start = esc(entry?.start || "");
    const end = esc(entry?.end || "");
    const period = [start, end].filter(Boolean).join(" - ");
    return `
      <article class="role-item">
        <h3>${degree || "Education"}</h3>
        ${school ? `<p>${school}</p>` : ""}
        ${period ? `<p class="muted-small">${period}</p>` : ""}
      </article>
    `;
  }).join("");
}

function renderSkills(skills) {
  const groups = skills && typeof skills === "object" ? Object.entries(skills) : [];
  if (groups.length === 0) {
    return '<p class="muted-small">No skills added yet.</p>';
  }

  return groups.map(([group, values]) => `
    <article class="role-item">
      <h3>${esc(group)}</h3>
      ${asList(values || [])}
    </article>
  `).join("");
}

function renderPortfolio(data) {
  const b = data?.basics || {};
  const summary = data?.summary || "";

  app.innerHTML = `
    <main class="preview-wrap">
      <section class="preview-card">
        <div class="preview-head">
          <div>
            <h1 class="preview-name">${esc(b.name || "Portfolio Preview")}</h1>
            <p class="preview-role">${esc(b.role || "")}</p>
            <div class="preview-links">
              ${link(b.linkedin, "LinkedIn")}
              ${link(b.github, "GitHub")}
              ${link(data?.publicUrl, "Public URL")}
            </div>
          </div>
          <a href="/" class="btn btn--secondary">Back to Builder</a>
        </div>

        <dl class="kv">
          <dt>Email</dt><dd>${esc(b.email || "-")}</dd>
          <dt>Phone</dt><dd>${esc(b.phone || "-")}</dd>
          <dt>Location</dt><dd>${esc(b.location || "-")}</dd>
        </dl>
      </section>

      <section class="preview-card">
        <h2>Summary</h2>
        <p>${esc(summary || "No summary provided yet.")}</p>
      </section>

      <section class="preview-grid">
        <section class="preview-card">
          <h2>Experience</h2>
          ${renderExperience(data?.experience || [])}
        </section>
        <section class="preview-card">
          <h2>Education</h2>
          ${renderEducation(data?.education || [])}
        </section>
      </section>

      <section class="preview-card">
        <h2>Skills</h2>
        ${renderSkills(data?.skills || {})}
      </section>

      <section class="preview-card">
        <h2>Certifications</h2>
        ${asList(data?.certifications || [])}
      </section>
    </main>
  `;
}

function renderError(message) {
  app.innerHTML = `
    <main class="preview-wrap">
      <section class="preview-card">
        <div class="banner banner--error">${esc(message)}</div>
        <p class="muted-small">Example: <code>/preview.html?src=/assets/resume.daniel-kim.json</code></p>
      </section>
    </main>
  `;
}

async function init() {
  try {
    const params = new URLSearchParams(window.location.search);
    const src = (params.get("src") || "/assets/resume.daniel-kim.json").trim();

    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Could not load JSON (${res.status}).`);
    }

    const data = await res.json();
    renderPortfolio(data);
  } catch (err) {
    renderError(err?.message || "Could not load preview JSON.");
  }
}

init();
