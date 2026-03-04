function escapeForJavascript(value) {
  return JSON.stringify(String(value || ""));
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).send("console.warn('Metodo no permitido para pixel-script.');");
    return;
  }

  const pixelId =
    typeof process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID === "string"
      ? process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID.trim()
      : "";

  if (!pixelId) {
    res
      .status(200)
      .send(
        "console.warn('Facebook Pixel desactivado: configura NEXT_PUBLIC_FACEBOOK_PIXEL_ID.');"
      );
    return;
  }

  const pixelLiteral = escapeForJavascript(pixelId);

  res.status(200).send(
    `(function(f,b,e,v,n,t,s){` +
      `if(f.fbq)return;` +
      `n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};` +
      `if(!f._fbq)f._fbq=n;` +
      `n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];` +
      `t=b.createElement(e);t.async=!0;t.src=v;` +
      `s=b.getElementsByTagName(e)[0];` +
      `if(s&&s.parentNode){s.parentNode.insertBefore(t,s);}` +
    `})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');` +
    `window.NEXT_PUBLIC_FACEBOOK_PIXEL_ID=${pixelLiteral};` +
    `if(window.pixel&&typeof window.pixel.setPixelId==='function'){window.pixel.setPixelId(${pixelLiteral});}` +
    `window.fbq('init', ${pixelLiteral});` +
    `window.fbq('track', 'PageView');`
  );
};
