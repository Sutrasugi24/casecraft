let deferredInstallPrompt = null;

function setConnectionStatus(element) {
  if (!element) return;
  const offline = !navigator.onLine;
  element.dataset.offline = String(offline);
  element.textContent = offline ? "Offline · workspace lokal aktif" : "Lokal · siap offline";
}

export function initPwa() {
  const installButton = document.querySelector("#install-app");
  const connectionStatus = document.querySelector("#connection-status");
  setConnectionStatus(connectionStatus);
  window.addEventListener("online", () => setConnectionStatus(connectionStatus));
  window.addEventListener("offline", () => setConnectionStatus(connectionStatus));
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });
  installButton?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    await deferredInstallPrompt.prompt();
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
  window.addEventListener("appinstalled", () => { if (installButton) installButton.hidden = true; });
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {
      if (connectionStatus) connectionStatus.textContent = "Lokal · cache offline belum tersedia";
    });
  }
}

