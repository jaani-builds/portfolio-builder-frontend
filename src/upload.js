import { api } from "./api.js";

const escapeHtml = (v = "") =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

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

  const linkedinUrl = safeHttpUrl(b.linkedin);
  const githubUrl = safeHttpUrl(b.github);

  return `
    <div class="json-summary">
      <dl>
        <dt>Name</dt>       <dd>${escapeHtml(b.name || "—")}</dd>
        <dt>Role</dt>       <dd>${escapeHtml(b.role || "—")}</dd>
        <dt>Email</dt>      <dd>${escapeHtml(b.email || "—")}</dd>
        <dt>Phone</dt>      <dd>${escapeHtml(b.phone || "—")}</dd>
        <dt>Location</dt>   <dd>${escapeHtml(b.location || "—")}</dd>
        <dt>LinkedIn</dt>   <dd>${linkedinUrl ? `<a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener">${escapeHtml(linkedinUrl)}</a>` : "—"}</dd>
        <dt>GitHub</dt>     <dd>${githubUrl ? `<a href="${escapeHtml(githubUrl)}" target="_blank" rel="noopener">${escapeHtml(githubUrl)}</a>` : "—"}</dd>
        <dt>Experience</dt> <dd>${exp.length} role${exp.length === 1 ? "" : "s"} detected</dd>
        <dt>Education</dt>  <dd>${edu.length} entr${edu.length === 1 ? "y" : "ies"} detected</dd>
        <dt>Skill groups</dt><dd>${Object.keys(skills).length}</dd>
        <dt>Certs</dt>      <dd>${certs.length}</dd>
      </dl>
    </div>
  `;
}

function renderPdfStatus(url, prefix = "PDF attached") {
  const safeUrl = safeHttpUrl(url);
  if (!safeUrl) return escapeHtml(prefix);
  return `${escapeHtml(prefix)}: <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener">View PDF</a>`;
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
  const recommendationsText = container.querySelector("#editor-recommendations")?.value || "[]";
  const experimentsText = container.querySelector("#editor-experiments")?.value || "[]";

  const updated = {
    ...parsedResume,
    basics: parseJsonSection(basicsText, "basics"),
    summary: summaryText.trim(),
    experience: parseJsonSection(experienceText, "experience"),
    education: parseJsonSection(educationText, "education"),
    skills: parseJsonSection(skillsText, "skills"),
    certifications: parseJsonSection(certsText, "certifications"),
    recommendations: parseJsonSection(recommendationsText, "recommendations"),
    experiments: parseJsonSection(experimentsText, "experiments"),
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
          class="file-input--hidden"
          type="file"
          accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/msword,.doc"
        />
        <label for="resume-file" class="btn btn--secondary file-pick-btn">Choose file</label>
        <div id="picked-file-name" class="form-hint" style="margin-top:.45rem;">No file selected</div>
        <p class="form-hint">Supported: PDF and Word (.docx). Legacy .doc support depends on extracted text availability.</p>
        <div id="file-status" class="form-hint" style="margin-top:.5rem;"></div>
      </div>

      <button id="btn-parse" class="btn btn--primary">Extract &amp; Parse Resume</button>

      <div id="parse-result" style="margin-top:2rem;display:none;">
        <h3>Review &amp; Edit Categories</h3>
        <p class="form-hint" style="margin-bottom:1rem;">Open each section to review what was detected. Empty sections are collapsed — tap to open and fill in manually.</p>
        <div class="category-editor">

          <details class="acc" id="acc-basics">
            <summary class="acc__hd">
              <span class="acc__title">Basics</span>
              <span class="acc__badge" id="badge-basics">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">Name, title, contact details and social links. JSON object.</p>
              <textarea id="editor-basics" class="code" rows="10" spellcheck="false"></textarea>
            </div>
          </details>

          <details class="acc" id="acc-summary">
            <summary class="acc__hd">
              <span class="acc__title">Summary</span>
              <span class="acc__badge" id="badge-summary">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">A short professional summary paragraph (plain text).</p>
              <textarea id="editor-summary" class="code" rows="4" spellcheck="false"></textarea>
            </div>
          </details>

          <details class="acc" id="acc-experience">
            <summary class="acc__hd">
              <span class="acc__title">Experience</span>
              <span class="acc__badge" id="badge-experience">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">Array of roles — title, company, location, start, end, highlights.</p>
              <textarea id="editor-experience" class="code" rows="10" spellcheck="false"></textarea>
            </div>
          </details>

          <details class="acc" id="acc-education">
            <summary class="acc__hd">
              <span class="acc__title">Education</span>
              <span class="acc__badge" id="badge-education">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">Array of degrees — degree, school, start, end.</p>
              <textarea id="editor-education" class="code" rows="7" spellcheck="false"></textarea>
            </div>
          </details>

          <details class="acc" id="acc-skills">
            <summary class="acc__hd">
              <span class="acc__title">Skills</span>
              <span class="acc__badge" id="badge-skills">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">JSON object — category names as keys, arrays of skills as values.</p>
              <textarea id="editor-skills" class="code" rows="8" spellcheck="false"></textarea>
            </div>
          </details>

          <details class="acc" id="acc-certifications">
            <summary class="acc__hd">
              <span class="acc__title">Certifications</span>
              <span class="acc__badge" id="badge-certifications">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">JSON array of certification strings.</p>
              <textarea id="editor-certifications" class="code" rows="5" spellcheck="false"></textarea>
            </div>
          </details>

          <details class="acc" id="acc-recommendations">
            <summary class="acc__hd">
              <span class="acc__title">Recommendations</span>
              <span class="acc__badge" id="badge-recommendations">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">JSON array of recommendation objects (name, role, quote, source, linkedinUrl).</p>
              <textarea id="editor-recommendations" class="code" rows="7" spellcheck="false" placeholder='[{"name":"","role":"","quote":"","source":"","linkedinUrl":""}]'></textarea>
            </div>
          </details>

          <details class="acc" id="acc-experiments">
            <summary class="acc__hd">
              <span class="acc__title">Experiments</span>
              <span class="acc__badge" id="badge-experiments">—</span>
            </summary>
            <div class="acc__body">
              <p class="form-hint">JSON array of experiment objects (name, type, backend, frontend).</p>
              <textarea id="editor-experiments" class="code" rows="8" spellcheck="false" placeholder='[{"name":"","type":"","backend":{"tech":[],"highlights":[],"links":[]},"frontend":{"tech":[],"highlights":[],"links":[]}}]'></textarea>
            </div>
          </details>

        </div>
        <div class="parse-actions">
          <button id="btn-accept" class="btn btn--primary">Confirm categories &amp; continue</button>
          <button id="btn-reparse" class="btn btn--secondary">Re-upload</button>
        </div>
      </div>
    </div>
  `;

  const bannerEl = container.querySelector("#upload-banner");
  const resultEl = container.querySelector("#parse-result");
  const parseBtn = container.querySelector("#btn-parse");
  const resumeFileInput = container.querySelector("#resume-file");
  const pickedFileNameEl = container.querySelector("#picked-file-name");
  const fileStatusEl = container.querySelector("#file-status");
  const editorBasics = container.querySelector("#editor-basics");
  const editorSummary = container.querySelector("#editor-summary");
  const editorExperience = container.querySelector("#editor-experience");
  const editorEducation = container.querySelector("#editor-education");
  const editorSkills = container.querySelector("#editor-skills");
  const editorCertifications = container.querySelector("#editor-certifications");
  const editorRecommendations = container.querySelector("#editor-recommendations");
  const editorExperiments = container.querySelector("#editor-experiments");

  function setAccordion(id, badgeId, open, badgeText, isEmpty) {
    const el = container.querySelector(`#${id}`);
    const badge = container.querySelector(`#${badgeId}`);
    if (el) el.open = open;
    if (badge) {
      badge.textContent = badgeText;
      badge.classList.toggle("acc__badge--empty", !!isEmpty);
    }
  }

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

  resumeFileInput?.addEventListener("change", () => {
    const selected = resumeFileInput.files?.[0]?.name;
    if (pickedFileNameEl) {
      pickedFileNameEl.textContent = selected ? `Selected: ${selected}` : "No file selected";
    }
  });

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

      editorBasics.value = formatSection(parsed.basics || {});
      editorSummary.value = formatSection(parsed.summary || "");
      editorExperience.value = formatSection(parsed.experience || []);
      editorEducation.value = formatSection(parsed.education || []);
      editorSkills.value = formatSection(parsed.skills || {});
      editorCertifications.value = formatSection(parsed.certifications || []);
      editorRecommendations.value = formatSection(parsed.recommendations || []);
      editorExperiments.value = formatSection(parsed.experiments || []);

      // Keep all categories collapsed by default. Badges still surface parse quality.
      const expLen = (parsed.experience || []).length;
      const eduLen = (parsed.education || []).length;
      const skillGroups = Object.keys(parsed.skills || {}).length;
      const certLen = (parsed.certifications || []).length;
      const recommendationsLen = (parsed.recommendations || []).length;
      const experimentsLen = (parsed.experiments || []).length;
      const hasBasics = !!(parsed.basics?.name || parsed.basics?.email);
      const hasSummary = !!(parsed.summary || "").trim();

      setAccordion("acc-basics", "badge-basics", false,
        hasBasics ? (parsed.basics.name || "Filled") : "Empty — fill in",
        !hasBasics);
      setAccordion("acc-summary", "badge-summary", false,
        hasSummary ? `${(parsed.summary || "").split(/\s+/).filter(Boolean).length} words` : "Empty — fill in",
        !hasSummary);
      setAccordion("acc-experience", "badge-experience", false,
        expLen > 0 ? `${expLen} role${expLen === 1 ? "" : "s"}` : "Empty — fill in",
        expLen === 0);
      setAccordion("acc-education", "badge-education", false,
        eduLen > 0 ? `${eduLen} entr${eduLen === 1 ? "y" : "ies"}` : "Empty — fill in",
        eduLen === 0);
      setAccordion("acc-skills", "badge-skills", false,
        skillGroups > 0 ? `${skillGroups} group${skillGroups === 1 ? "" : "s"}` : "Empty — fill in",
        skillGroups === 0);
      setAccordion("acc-certifications", "badge-certifications", false,
        certLen > 0 ? `${certLen} item${certLen === 1 ? "" : "s"}` : "Empty — fill in",
        certLen === 0);
      setAccordion("acc-recommendations", "badge-recommendations", false,
        recommendationsLen > 0 ? `${recommendationsLen} item${recommendationsLen === 1 ? "" : "s"}` : "Empty — fill in",
        recommendationsLen === 0);
      setAccordion("acc-experiments", "badge-experiments", false,
        experimentsLen > 0 ? `${experimentsLen} item${experimentsLen === 1 ? "" : "s"}` : "Empty — fill in",
        experimentsLen === 0);

      resultEl.style.display = "block";
      parseBtn.style.display = "none";
      showBanner("Resume parsed. Review each section and confirm.", "success");
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
    if (pickedFileNameEl) pickedFileNameEl.textContent = "No file selected";
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

      <div class="publish-actions">
        <a href="${escUrl}" target="_blank" rel="noopener" class="btn btn--primary">Open portfolio</a>
        <button id="btn-update-slug" class="btn btn--secondary">Change username</button>
        <button id="btn-upload-again" class="btn btn--secondary">Upload new resume</button>
      </div>
    </div>
  `;

  container.querySelector("#btn-update-slug").addEventListener("click", () => {
    onChangeSlug();
  });
  container.querySelector("#btn-upload-again").addEventListener("click", () => {
    onUploadAgain();
  });
}
