
import { app, session } from "electron";

let currentMirror: { enabled: boolean; url: string } = { enabled: false, url: "https://mirror.ghproxy.com/" };
let hookInstalled = false;

export function applyGithubMirrorFromAppSettings(settings: any) {
  const s = settings as { enableGithubAcceleration?: boolean; githubAccelerationUrl?: string };
  const enabled = s.enableGithubAcceleration ?? false;
  // Make sure it ends with a slash for proxying
  let url = (s.githubAccelerationUrl || "https://mirror.ghproxy.com/").trim();
  if (!url.endsWith("/")) {
    url += "/";
  }

  currentMirror = { enabled, url };
  applyToAllSessions();
}

function installSessionHook() {
  if (hookInstalled) return;
  hookInstalled = true;
  app.on("session-created", (ses) => {
    // Only apply to the default session, not plugin panel sessions which have their own rules.
    if (ses === session.defaultSession) {
      applyToSession(ses);
    }
  });
}

function applyToAllSessions() {
  installSessionHook();
  if (session.defaultSession) {
    applyToSession(session.defaultSession);
  }
}

function applyToSession(ses: Electron.Session) {
  const filter = { urls: ["*://github.com/*", "*://raw.githubusercontent.com/*", "*://api.github.com/*"] };
  if (!currentMirror.enabled) {
    ses.webRequest.onBeforeRequest(filter, null as any);
    return;
  }

  ses.webRequest.onBeforeRequest(
    filter,
    (details, callback) => {
      let originalUrl = details.url;
      // Some proxies like ghproxy take the full url: https://mirror.ghproxy.com/https://github.com/...
      let newUrl = currentMirror.url + originalUrl;
      callback({ redirectURL: newUrl });
    }
  );
}

export function transformGithubUrl(url: string): string {
  if (!currentMirror.enabled) return url;
  if (
    url.startsWith("https://github.com/") ||
    url.startsWith("https://raw.githubusercontent.com/") ||
    url.startsWith("https://api.github.com/")
  ) {
    return currentMirror.url + url;
  }
  return url;
}

