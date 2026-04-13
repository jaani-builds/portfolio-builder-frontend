import { api } from "./api.js";

const escapeHtml = (v = "") =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function normalizePdfUrl(url = "") {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const localhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    if (!localhost) return url;

    // Rewrite legacy AWS-style S3 URL to LocalStack URL when running locally.
    const hostMatch = parsed.hostname.match(/^([^.]+)\.s3\.[^.]+\.amazonaws\.com$/);
    if (!hostMatch) return url;

    const bucket = hostMatch[1];
    const key = parsed.pathname.replace(/^\/+/, "");
    if (!bucket || !key) return url;
    return `http://localhost:4566/${bucket}/${key}`;
  } catch {
    return url;
  }
}

function renderParsedSummary(data) {
  const b = data?.basics ?? {};
  const exp = data?.experience ?? [];
  const edu = data?.education ?? [];
  const skills = data?.skills ?? {};
  const certs = data?.certifications ?? [];

  return `
    <div class="json-summary">
      <dl>
        <dt>Name</dt>       <dd>${escapeHtml(b.name || "—")}</dd>
        <dt>Role</dt>       <dd>${escapeHtml(b.role || "—")}</dd>
        <dt>Email</dt>      <dd>${escapeHtml(b.email || "—")}</dd>
        <dt>Phone</dt>      <dd>${escapeHtml(b.phone || "—")}</dd>
        <dt>Location</dt>   <dd>${escapeHtml(b.location || "—")}</dd>
        <dt>LinkedIn</dt>   <dd>${b.linkedin ? `<a href="${escapeHtml(b.linkedin)}" target="_blank" rel="noopener">${escapeHtml(b.linkedin)}</a>` : "—"}</dd>
        <dt>GitHub</dt>     <dd>${b.github ? `<a href="${escapeHtml(b.github)}" target="_blank" rel="noopener">${escapeHtml(b.github)}</a>` : "—"}</dd>
        <dt>Experience</dt> <dd>${exp.length} role${exp.length === 1 ? "" : "s"} detected</dd>
        <dt>Education</dt>  <dd>${edu.length} entr${edu.length === 1 ? "y" : "ies"} detected</dd>
        <dt>Skill groups</dt><dd>${Object.keys(skills).length}</dd>
        <dt>Certs</dt>      <dd>${certs.length}</dd>
      </dl>
    </div>
  `;
}

export function renderUpload(container, onParsed) {
  container.innerHTML = `
    <div class="flow-shell">
      <h2>Step 1 — Upload your resume</h2>
      <p class="subtitle">Paste the plain text of your resume. This same workflow handles first-time publish and future updates.</p>

      <div id="upload-banner"></div>

      <div class="form-group">
        <label class="form-label" for="resume-text">Resume text</label>
        <textarea
          id="resume-text"
          class="code"
          rows="18"
          placeholder="Paste your resume here…"
          maxlength="50000"
          spellcheck="false"
        ></textarea>
        <p class="form-hint">Plain text only. Max 50,000 characters.</p>
      </div>

      <div class="form-group">
        <label class="form-label" for="pdf-file">Resume PDF</label>
        <input
          id="pdf-file"
          type="file"
          accept="application/pdf,.pdf"
        />
        <p class="form-hint">Optional. Upload a PDF and the app will store it in a dedicated public GitHub repo in your account, then attach that link to the Download PDF button automatically.</p>
        <div id="pdf-status" class="form-hint" style="margin-top:.5rem;"></div>
      </div>

      <button id="btn-parse" class="btn btn--primary">Parse Resume</button>

      <div id="parse-result" style="margin-top:2rem;display:none;">
        <h3>Parsed fields</h3>
        <div id="parsed-summary"></div>
        <details style="margin-bottom:1.25rem;">
          <summary style="cursor:pointer;font-size:.88rem;color:var(--text-muted);">View full JSON</summary>
          <pre id="parsed-json" style="margin-top:.5rem;font-size:.78rem;background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:8px;overflow:auto;max-height:400px;"></pre>
        </details>
        <button id="btn-accept" class="btn btn--primary">Looks good — next step</button>
        <button id="btn-reparse" class="btn btn--secondary" style="margin-left:.5rem;">Re-upload</button>
      </div>
    </div>
  `;

  const bannerEl = container.querySelector("#upload-banner");
  const resultEl = container.querySelector("#parse-result");
  const summaryEl = container.querySelector("#parsed-summary");
  const jsonEl = container.querySelector("#parsed-json");
  const parseBtn = container.querySelector("#btn-parse");
  const textarea = container.querySelector("#resume-text");
  const pdfFileInput = container.querySelector("#pdf-file");
  const pdfStatusEl = container.querySelector("#pdf-status");

  let parsedResume = null;
  let existingPdfUrl = "";
  let pdfUploadedThisCycle = false;

  api.getResume().then((resume) => {
    if (resume?.pdfUrl) {
      existingPdfUrl = normalizePdfUrl(resume.pdfUrl);
      pdfStatusEl.innerHTML = `Current PDF link: <a href="${escapeHtml(existingPdfUrl)}" target="_blank" rel="noopener">${escapeHtml(existingPdfUrl)}</a>`;
    }
  }).catch(() => {});

  function showBanner(msg, type = "error") {
    bannerEl.innerHTML = `<div class="banner banner--${type}">${escapeHtml(msg)}</div>`;
  }

  parseBtn.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text) { showBanner("Please paste your resume text first."); return; }

    parseBtn.disabled = true;
    parseBtn.textContent = "Parsing…";
    bannerEl.innerHTML = "";

    try {
      const { parsed } = await api.uploadResume(text);
      let pdfUrl = existingPdfUrl;

      const pdfFile = pdfFileInput.files?.[0];
      if (pdfFile) {
        const pdfUpload = await api.uploadResumePdf(pdfFile);
        pdfUrl = normalizePdfUrl(pdfUpload.pdfUrl || "");
        existingPdfUrl = pdfUrl;
        pdfUploadedThisCycle = true;
        pdfFileInput.value = "";
        pdfStatusEl.innerHTML = `PDF uploaded: <a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${escapeHtml(pdfUrl)}</a>`;
      }

      parsed.pdfUrl = pdfUrl;
      await api.updateResumeJson(parsed);
      parsedResume = parsed;
      summaryEl.innerHTML = renderParsedSummary(parsed);
      jsonEl.textContent = JSON.stringify(parsed, null, 2);
      resultEl.style.display = "block";
      parseBtn.style.display = "none";
    } catch (err) {
      showBanner(err.message);
    } finally {
      parseBtn.disabled = false;
      parseBtn.textContent = "Parse Resume";
    }
  });

  container.querySelector("#btn-accept").addEventListener("click", async () => {
    if (!parsedResume) {
      showBanner("Parse your resume before continuing.");
      return;
    }

    try {
      const pdfFile = pdfFileInput.files?.[0];
      if (pdfFile && !pdfUploadedThisCycle) {
        const pdfUpload = await api.uploadResumePdf(pdfFile);
        existingPdfUrl = normalizePdfUrl(pdfUpload.pdfUrl || "");
        parsedResume.pdfUrl = existingPdfUrl;
        pdfUploadedThisCycle = true;
        pdfFileInput.value = "";
        pdfStatusEl.innerHTML = `PDF uploaded: <a href="${escapeHtml(existingPdfUrl)}" target="_blank" rel="noopener">${escapeHtml(existingPdfUrl)}</a>`;
        await api.updateResumeJson(parsedResume);
      } else if ((parsedResume.pdfUrl || "") !== existingPdfUrl) {
        parsedResume.pdfUrl = existingPdfUrl;
        await api.updateResumeJson(parsedResume);
      }
      onParsed();
    } catch (err) {
      showBanner(err.message);
    }
  });
  container.querySelector("#btn-reparse").addEventListener("click", () => {
    resultEl.style.display = "none";
    parseBtn.style.display = "";
    textarea.value = "";
    pdfUploadedThisCycle = false;
    bannerEl.innerHTML = "";
  });
}

export function renderSlugConfig(container, onPublished) {
  container.innerHTML = `
    <div class="flow-shell">
      <h2>Step 2 — Choose your portfolio address</h2>
      <p class="subtitle">
        Pick a unique slug for your portfolio URL. You can share this link with anyone and update it later anytime.
      </p>

      <div id="slug-banner"></div>

      <div class="form-group">
        <label class="form-label" for="slug-input">Portfolio slug</label>
        <input
          id="slug-input"
          type="text"
          placeholder="e.g. jane-doe"
          maxlength="50"
          autocomplete="off"
          spellcheck="false"
        />
        <p class="form-hint">Lowercase letters, numbers, and hyphens only. 3–50 characters.</p>
      </div>

      <div id="slug-preview" class="slug-preview" style="display:none;"></div>

      <button id="btn-publish" class="btn btn--primary" style="margin-top:1.25rem;">Save &amp; Publish</button>
    </div>
  `;

  const slugInput = container.querySelector("#slug-input");
  const previewEl = container.querySelector("#slug-preview");
  const bannerEl = container.querySelector("#slug-banner");
  const publishBtn = container.querySelector("#btn-publish");

  // Pre-fill if user already has a slug
  api.getSlug().then(({ slug }) => {
    if (slug) slugInput.value = slug;
    updatePreview();
  }).catch(() => {});

  function updatePreview() {
    let v = slugInput.value.trim().toLowerCase();
    // Auto-convert spaces to hyphens
    v = v.replace(/\s+/g, '-');
    // Collapse multiple consecutive hyphens into one
    v = v.replace(/-+/g, '-');
    // Strip leading/trailing hyphens
    v = v.replace(/^-+|-+$/g, '');
    if (v.length >= 3) {
      const base = api.publicOrigin();
      previewEl.style.display = "block";
      previewEl.innerHTML = `Your portfolio will be at: <strong>${escapeHtml(base)}/${escapeHtml(v)}/</strong>`;
    } else {
      previewEl.style.display = "none";
    }
  }

  slugInput.addEventListener("input", updatePreview);

  publishBtn.addEventListener("click", async () => {
    let slug = slugInput.value.trim().toLowerCase();
    // Auto-convert spaces to hyphens
    slug = slug.replace(/\s+/g, '-');
    // Collapse multiple consecutive hyphens into one
    slug = slug.replace(/-+/g, '-');
    // Strip leading/trailing hyphens
    slug = slug.replace(/^-+|-+$/g, '');
    bannerEl.innerHTML = "";
    if (!slug) { bannerEl.innerHTML = `<div class="banner banner--error">Please enter a slug.</div>`; return; }

    publishBtn.disabled = true;
    publishBtn.textContent = "Publishing…";

    try {
      const { url } = await api.setSlug(slug);
      onPublished(slug, url);
    } catch (err) {
      if (err.message === "That slug is already taken") {
        let suggestions = [];
        try {
          const data = await api.getSlugSuggestions(slug);
          suggestions = data.suggestions || [];
        } catch {
          suggestions = [];
        }

        bannerEl.innerHTML = `
          <div class="banner banner--error" style="margin-bottom:.6rem;">That slug is already taken.</div>
          <div class="slug-suggestions">
            ${suggestions.length
              ? `<p class="form-hint" style="margin-bottom:.5rem;">Try one of these:</p>
                 <div class="slug-suggestion-list">
                   ${suggestions.map((s) => `<button type="button" class="btn btn--secondary btn--suggestion" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
                 </div>`
              : ""
            }
            <button type="button" id="btn-auto-suffix" class="btn btn--secondary" style="margin-top:.6rem;">Auto-choose available slug</button>
          </div>
        `;

        bannerEl.querySelectorAll(".btn--suggestion").forEach((btn) => {
          btn.addEventListener("click", () => {
            slugInput.value = btn.dataset.suggest || "";
            updatePreview();
          });
        });

        bannerEl.querySelector("#btn-auto-suffix")?.addEventListener("click", async () => {
          publishBtn.disabled = true;
          publishBtn.textContent = "Publishing…";
          try {
            const result = await api.setSlug(slug, { auto_suffix_on_conflict: true });
            onPublished(result.slug, result.url);
          } catch (autoErr) {
            bannerEl.innerHTML = `<div class="banner banner--error">${escapeHtml(autoErr.message)}</div>`;
          } finally {
            publishBtn.disabled = false;
            publishBtn.textContent = "Save & Publish";
          }
        });
      } else {
        bannerEl.innerHTML = `<div class="banner banner--error">${escapeHtml(err.message)}</div>`;
      }
    } finally {
      publishBtn.disabled = false;
      publishBtn.textContent = "Save & Publish";
    }
  });
}

export function renderPublished(container, slug, url, actions = {}) {
  const fullUrl = /^https?:\/\//i.test(url) ? url : `${api.publicOrigin()}${url}`;
  const escUrl = escapeHtml(fullUrl);
  const onChangeSlug = actions.onChangeSlug || (() => { window.location.hash = "/dashboard/slug"; });
  const onUploadAgain = actions.onUploadAgain || (() => { window.location.hash = "/dashboard/upload"; });

  container.innerHTML = `
    <div class="flow-shell">
      <div class="banner banner--success">
        Your portfolio is live!
      </div>
      <h2>Portfolio published</h2>
      <p class="subtitle">Share the link below with anyone. It updates automatically when you upload a new resume.</p>

      <div class="slug-preview" style="margin-bottom:1.5rem;">
        <strong><a href="${escUrl}" target="_blank" rel="noopener">${escUrl}</a></strong>
      </div>

      <a href="${escUrl}" target="_blank" rel="noopener" class="btn btn--primary" style="margin-right:.5rem;">
        Open portfolio
      </a>
      <button id="btn-update-slug" class="btn btn--secondary">Change slug</button>
      <button id="btn-upload-again" class="btn btn--secondary" style="margin-left:.5rem;">Upload new resume</button>
    </div>
  `;

  container.querySelector("#btn-update-slug").addEventListener("click", () => {
    onChangeSlug();
  });
  container.querySelector("#btn-upload-again").addEventListener("click", () => {
    onUploadAgain();
  });
}
