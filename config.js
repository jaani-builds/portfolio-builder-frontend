// Use local API/public base when running the frontend on localhost.
const __PB_IS_LOCAL__ = ["localhost", "127.0.0.1", "0.0.0.0"].includes(window.location.hostname);

// API base (backend domain)
window.__PB_API_BASE__ = __PB_IS_LOCAL__
	? "http://localhost:8000"
	: "https://api.portfolio.handytools.work";

// Public portfolio base (viewer domain)
window.__PB_PUBLIC_BASE__ = __PB_IS_LOCAL__
	? "http://localhost:5174"
	: "https://portfolio.handytools.work";

// PayNow QR Code - Update with your PayNow ID
// Format: 0 or 1 (for UEN/NRIC) followed by 10-11 digit ID
// Example: window.__PAYNOW_ID__ = "0123456789012";
window.__PAYNOW_ID__ = "0123456789012";

// Preferred: host your official bank PayNow QR image in this repo and set its path.
// Example: window.__PAYNOW_QR_IMAGE__ = "assets/paynow-qr.png";
window.__PAYNOW_QR_IMAGE__ = "assets/paynow-qr.png";

// Optional but recommended: payee name users should verify before sending.
// Example: "JAANI NICKOLAS"
window.__PAYNOW_PAYEE_NAME__ = "Jaani Francis Nickolas";
