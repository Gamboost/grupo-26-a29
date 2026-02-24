(function initializeGlobalFacebookPixel(globalObject) {
  const PIXEL_CONFIG_ENDPOINT = "/api/pixel";
  const PIXEL_SCRIPT_ID = "fb-pixel-script";
  let lastTrackedLocation = "";
  let routeTrackingAttached = false;

  function getLocationSnapshot() {
    const { pathname, search, hash } = globalObject.location;
    return `${pathname}${search}${hash}`;
  }

  function trackPageview(force) {
    if (!globalObject.pixel || typeof globalObject.pixel.pageview !== "function") {
      return;
    }

    const currentLocation = getLocationSnapshot();
    if (!force && currentLocation === lastTrackedLocation) {
      return;
    }

    lastTrackedLocation = currentLocation;
    globalObject.pixel.pageview();
  }

  function attachRouteTracking() {
    if (routeTrackingAttached || !globalObject.history) {
      return;
    }
    routeTrackingAttached = true;

    const originalPushState = globalObject.history.pushState;
    const originalReplaceState = globalObject.history.replaceState;

    globalObject.history.pushState = function patchedPushState() {
      const result = originalPushState.apply(this, arguments);
      setTimeout(() => trackPageview(false), 0);
      return result;
    };

    globalObject.history.replaceState = function patchedReplaceState() {
      const result = originalReplaceState.apply(this, arguments);
      setTimeout(() => trackPageview(false), 0);
      return result;
    };

    globalObject.addEventListener("popstate", () => trackPageview(false));
    globalObject.addEventListener("hashchange", () => trackPageview(false));
  }

  async function resolvePixelId() {
    const inlinePixelId =
      typeof globalObject.NEXT_PUBLIC_FACEBOOK_PIXEL_ID === "string"
        ? globalObject.NEXT_PUBLIC_FACEBOOK_PIXEL_ID.trim()
        : "";

    if (inlinePixelId) {
      return inlinePixelId;
    }

    try {
      const response = await fetch(PIXEL_CONFIG_ENDPOINT, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const pixelId =
        payload && typeof payload.pixelId === "string" ? payload.pixelId.trim() : "";
      return pixelId;
    } catch (error) {
      console.warn("No se pudo obtener el Facebook Pixel ID:", error);
      return "";
    }
  }

  function loadPixelScript(pixelId) {
    return new Promise((resolve, reject) => {
      const existingScript = document.getElementById(PIXEL_SCRIPT_ID);
      if (existingScript) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.id = PIXEL_SCRIPT_ID;
      script.src = "/scripts/pixel.js";
      script.async = true;
      script.setAttribute("data-pixel-id", pixelId);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar /scripts/pixel.js"));
      document.head.appendChild(script);
    });
  }

  async function setup() {
    if (!globalObject.pixel || typeof globalObject.pixel.setPixelId !== "function") {
      console.warn("No se encontro /lib/fpixel.js para inicializar Facebook Pixel.");
      return;
    }

    const pixelId = await resolvePixelId();
    if (!pixelId) {
      console.warn(
        "Facebook Pixel desactivado: configura NEXT_PUBLIC_FACEBOOK_PIXEL_ID en el entorno."
      );
      return;
    }

    globalObject.pixel.setPixelId(pixelId);

    try {
      await loadPixelScript(pixelId);
    } catch (error) {
      console.warn("No se pudo cargar el script del pixel:", error);
      return;
    }

    attachRouteTracking();
    trackPageview(true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})(window);
