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

function renderPdfStatus(url, prefix = "PDF attached") {
  if (!url) return "";
  return `${escapeHtml(prefix)}: <a href="${escapeHtml(url)}" target="_blank" rel="noopener">View PDF</a>`;
}

function formatSection(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function parseJsonSection(raw, sectionName) {
  const text = (raw || "").trim();
  if (!text) {
    if (sectionName === "skills") return {};
    return [];
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON in ${sectionName}. Please fix formatting and try again.`);
  }
}

function buildResumeFromEditor(parsedResume, existingPdfUrl, container) {
  const basicsText = container.querySelector("#editor-basics")?.value || "{}";
  const summaryText = container.querySelector("#editor-summary")?.value || "";
  const experienceText = container.querySelector("#editor-experience")?.value || "[]";
  const educationText = container.querySelector("#editor-education")?.value || "[]";
  const skillsText = container.querySelector("#editor-skills")?.value || "{}";
  const certsText = container.querySelector("#editor-certifications")?.value || "[]";

  const updated = {
    ...parsedResume,
    basics: parseJsonSection(basicsText, "basics"),
    summary: summaryText.trim(),
    experience: parseJsonSection(experienceText, "experience"),
    education: parseJsonSection(educationText, "education"),
    skills: parseJsonSection(skillsText, "skills"),
    certifications: parseJsonSection(certsText, "certifications"),
    pdfUrl: existingPdfUrl || parsedResume.pdfUrl || "",
  };

  return updated;
}

export function renderUpload(container, onParsed) {
  container.innerHTML = `
    <div class="flow-shell">
      <h2>Step 1 — Upload your resume</h2>
      <p class="subtitle">Upload your resume file. We will extract text, parse it into template categories, then let you validate and edit before publishing.</p>

      <div id="upload-banner"></div>

      <div class="form-group">
        <label class="form-label" for="resume-file">Resume file</label>
        <input
          id="resume-file"
          type="file"
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc"
        />
        <p class="form-hint">Supported: PDF and Word (.docx). Legacy .doc support depends on extracted text availability.</p>
        <div id="file-status" class="form-hint" style="margin-top:.5rem;"></div>
      </div>

      <button id="btn-parse" class="btn btn--primary">Extract &amp; Parse Resume</button>

      <div id="parse-result" style="margin-top:2rem;display:none;">
        <h3>Validate Parsed Categories</h3>
        <p class="form-hint" style="margin-bottom:1rem;">Review and edit each section based on the template before continuing to publish.</p>
        <div id="parsed-summary"></div>
        <div class="category-editor">
          <div class="category-editor__section">
            <label class="form-label" for="editor-basics">Basics (JSON object)</label>
            <textarea id="editor-basics" class="code" rows="8" spellcheck="false"></textarea>
          </div>
          <div class="category-editor__section">
            <label class="form-label" for="editor-summary">Summary</label>
            <textarea id="editor-summary" class="code" rows="5" spellcheck="false"></textarea>
          </div>
          <div class="category-editor__section">
            <label class="form-label" for="editor-experience">Experience (JSON array)</label>
            <textarea id="editor-experience" class="code" rows="9" spellcheck="false"></textarea>
          </div>
          <div class="category-editor__section">
            <label class="form-label" for="editor-education">Education (JSON array)</label>
            <textarea id="editor-education" class="code" rows="7" spellcheck="false"></textarea>
          </div>
          <div class="category-editor__section">
            <label class="form-label" for="editor-skills">Skills (JSON object)</label>
            <textarea id="editor-skills" class="code" rows="8" spellcheck="false"></textarea>
          </div>
          <div class="category-editor__section">
            <label class="form-label" for="editor-certifications">Certifications (JSON array)</label>
            <textarea id="editor-certifications" class="code" rows="6" spellcheck="false"></textarea>
          </div>
        </div>
        <details style="margin-bottom:1.25rem;">
          <summary style="cursor:pointer;font-size:.88rem;color:var(--text-muted);">View full JSON</summary>
          <pre id="parsed-json" style="margin-top:.5rem;font-size:.78rem;background:#1e1e1e;color:#d4d4d4;padding:1rem;border-radius:8px;overflow:auto;max-height:400px;"></pre>
        </details>
        <button id="btn-accept" class="btn btn--primary">Confirm categories &amp; continue</button>
        <button id="btn-reparse" class="btn btn--secondary" style="margin-left:.5rem;">Re-upload</button>
      </div>
    </div>
  `;

  const bannerEl = container.querySelector("#upload-banner");
  const resultEl = container.querySelector("#parse-result");
  const summaryEl = container.querySelector("#parsed-summary");
  const jsonEl = container.querySelector("#parsed-json");
  const parseBtn = container.querySelector("#btn-parse");
  const resumeFileInput = container.querySelector("#resume-file");
  const fileStatusEl = container.querySelector("#file-status");
  const editorBasics = container.querySelector("#editor-basics");
  const editorSummary = container.querySelector("#editor-summary");
  const editorExperience = container.querySelector("#editor-experience");
  const editorEducation = container.querySelector("#editor-education");
  const editorSkills = container.querySelector("#editor-skills");
  const editorCertifications = container.querySelector("#editor-certifications");

  let parsedResume = null;
  let existingPdfUrl = "";
  let pdfUploadedThisCycle = false;

  api.getResume().then((resume) => {
    if (resume?.pdfUrl) {
      existingPdfUrl = normalizePdfUrl(resume.pdfUrl);
      fileStatusEl.innerHTML = renderPdfStatus(existingPdfUrl, "Current PDF");
    }
  }).catch(() => {});

  function showBanner(msg, type = "error") {
    bannerEl.innerHTML = `<div class="banner banner--${type}">${escapeHtml(msg)}</div>`;
  }

  parseBtn.addEventListener("click", async () => {
    const resumeFile = resumeFileInput.files?.[0];
    if (!resumeFile) { showBanner("Please upload a resume file first."); return; }

    parseBtn.disabled = true;
    parseBtn.textContent = "Extracting & parsing…";
    bannerEl.innerHTML = "";

    try {
      const { text } = await api.extractResumeTextFromFile(resumeFile);
      if (!text || !text.trim()) {
        throw new Error("Could not extract text from this file.");
      }

      const { parsed } = await api.uploadResume(text);
      let pdfUrl = existingPdfUrl;

      const isPdf = (resumeFile.name || "").toLowerCase().endsWith(".pdf") || resumeFile.type === "application/pdf";
      if (isPdf) {
        const pdfUpload = await api.uploadResumePdf(resumeFile);
        pdfUrl = normalizePdfUrl(pdfUpload.pdfUrl || "");
        existingPdfUrl = pdfUrl;
        pdfUploadedThisCycle = true;
        fileStatusEl.innerHTML = renderPdfStatus(pdfUrl, "PDF uploaded");
      }

      parsed.pdfUrl = pdfUrl;
      await api.updateResumeJson(parsed);
      parsedResume = parsed;
      summaryEl.innerHTML = renderParsedSummary(parsed);

      editorBasics.value = formatSection(parsed.basics || {});
      editorSummary.value = formatSection(parsed.summary || "");
      editorExperience.value = formatSection(parsed.experience || []);
      editorEducation.value = formatSection(parsed.education || []);
      editorSkills.value = formatSection(parsed.skills || {});
      editorCertifications.value = formatSection(parsed.certifications || []);

      jsonEl.textContent = JSON.stringify(parsed, null, 2);
      resultEl.style.display = "block";
      parseBtn.style.display = "none";
      showBanner("Resume parsed into template categories. Review and confirm.", "success");
    } catch (err) {
      showBanner(err.message);
    } finally {
      parseBtn.disabled = false;
      parseBtn.textContent = "Extract & Parse Resume";
    }
  });

  container.querySelector("#btn-accept").addEventListener("click", async () => {
    if (!parsedResume) {
      showBanner("Parse your resume before continuing.");
      return;
    }

    try {
      const resumeFile = resumeFileInput.files?.[0];
      const isPdf = resumeFile && (((resumeFile.name || "").toLowerCase().endsWith(".pdf")) || resumeFile.type === "application/pdf");
      if (isPdf && !pdfUploadedThisCycle) {
        const pdfUpload = await api.uploadResumePdf(resumeFile);
        existingPdfUrl = normalizePdfUrl(pdfUpload.pdfUrl || "");
        pdfUploadedThisCycle = true;
        fileStatusEl.innerHTML = renderPdfStatus(existingPdfUrl, "PDF uploaded");
      }

      const reviewedResume = buildResumeFromEditor(parsedResume, existingPdfUrl, container);
      parsedResume = reviewedResume;
      await api.updateResumeJson(reviewedResume);
      onParsed();
    } catch (err) {
      showBanner(err.message);
    }
  });
  container.querySelector("#btn-reparse").addEventListener("click", () => {
    resultEl.style.display = "none";
    parseBtn.style.display = "";
    if (resumeFileInput) resumeFileInput.value = "";
    pdfUploadedThisCycle = false;
    bannerEl.innerHTML = "";
    fileStatusEl.innerHTML = existingPdfUrl ? renderPdfStatus(existingPdfUrl, "Current PDF") : "";
  });
}

export function renderSlugConfig(container, onPublished) {
  container.innerHTML = `
    <div class="flow-shell">
      <h2>Step 2 — Publish your portfolio</h2>
      <p class="subtitle">
        Pick a unique username for your portfolio URL. You can share this link with anyone and update it later anytime.
      </p>

      <div id="slug-banner"></div>

      <div class="form-group">
        <label class="form-label" for="slug-input">Username</label>
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
    if (!slug) { bannerEl.innerHTML = `<div class="banner banner--error">Please enter a username.</div>`; return; }

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
          <div class="banner banner--error" style="margin-bottom:.6rem;">That username is already taken.</div>
          <div class="slug-suggestions">
            ${suggestions.length
              ? `<p class="form-hint" style="margin-bottom:.5rem;">Try one of these:</p>
                 <div class="slug-suggestion-list">
                   ${suggestions.map((s) => `<button type="button" class="btn btn--secondary btn--suggestion" data-suggest="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}
                 </div>`
              : ""
            }
            <button type="button" id="btn-auto-suffix" class="btn btn--secondary" style="margin-top:.6rem;">Auto-choose available username</button>
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
      <button id="btn-update-slug" class="btn btn--secondary">Change username</button>
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
