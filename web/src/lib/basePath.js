// Where the app is mounted. Standalone that's the site root (""); behind a
// reverse proxy like Nova it's a sub-path (e.g. "/drops/aisdlc-visualizer").
//
// Nova serves the SPA under that prefix and rewrites the <base href> in the HTML
// to match, so we read it from there and use it to prefix every API/WS/SSE call
// and the router basename — otherwise a leading-slash URL would resolve against
// the site root and leave the Drop (404). Empty-safe: "" locally, so nothing
// changes in standalone/dev.
function derive() {
  try {
    const href = document.querySelector('base')?.getAttribute('href');
    if (!href) return '';
    const path = new URL(href, window.location.origin).pathname;
    return path.replace(/\/+$/, ''); // "" at root, "/drops/x" under a Drop
  } catch {
    return '';
  }
}

export const BASE_PATH = derive();

// Prefix an app-absolute path (e.g. "/api/initiatives") with the mount path.
export const apiPath = (p) => `${BASE_PATH}${p.startsWith('/') ? p : `/${p}`}`;
