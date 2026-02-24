(function attachPixelHelpers(globalObject) {
  const state = {
    pixelId: "",
  };

  const pixel = {
    get FB_PIXEL_ID() {
      return state.pixelId;
    },
    setPixelId(pixelId) {
      state.pixelId =
        typeof pixelId === "string" ? pixelId.trim() : String(pixelId || "").trim();
    },
    pageview() {
      if (typeof globalObject.fbq !== "function") {
        return;
      }
      globalObject.fbq("track", "PageView");
    },
    event(name, options) {
      if (typeof globalObject.fbq !== "function" || !name) {
        return;
      }
      globalObject.fbq("track", name, options || {});
    },
  };

  globalObject.pixel = pixel;
})(window);
