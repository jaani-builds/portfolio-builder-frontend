import { api } from "./api.js";

export function renderLogin(app) {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-topbar">
        <div class="login-topbar__title">Portfolio Builder</div>
        <div id="oauth-buttons" class="login-actions">
          <div class="signin-dropdown">
            <button class="btn btn--signin-prominent" id="btn-signin-toggle" type="button">
              Sign In
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="signin-dropdown-menu" id="signin-menu">
              <button class="oauth-option" id="btn-github" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                GitHub
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="login-hero">
        <div class="login-intro">
          <iframe
            class="login-intro__frame"
            src="assets/intro.html"
            title="Portfolio Builder intro"
            loading="lazy"
          ></iframe>
        </div>
        <div id="login-error" class="banner banner--error login-error" style="display:none;"></div>
      </div>
    </div>
  `;

  const signinToggle = document.getElementById("btn-signin-toggle");
  const signinDropdown = document.querySelector(".signin-dropdown");
  let closeTimer = null;

  signinToggle.addEventListener("click", () => {
    const menu = document.getElementById("signin-menu");
    menu.classList.toggle("open");
  });

  signinDropdown.addEventListener("mouseleave", () => {
    closeTimer = setTimeout(() => {
      document.getElementById("signin-menu").classList.remove("open");
    }, 400);
  });

  signinDropdown.addEventListener("mouseenter", () => {
    if (closeTimer) clearTimeout(closeTimer);
  });

  document.getElementById("btn-github").addEventListener("click", () => {
    const errorEl = document.getElementById("login-error");
    try {
      api.loginGithub();
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err?.message || "Could not start GitHub sign in.";
        errorEl.style.display = "block";
      }
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    const dropdown = document.querySelector(".signin-dropdown");
    if (dropdown && !dropdown.contains(e.target)) {
      document.getElementById("signin-menu").classList.remove("open");
    }
  });
}
