module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store, max-age=0");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).end();
    return;
  }

  const pixelId =
    typeof process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID === "string"
      ? process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID.trim()
      : "";

  if (!pixelId) {
    res.status(204).end();
    return;
  }

  const params = new URLSearchParams({
    id: pixelId,
    ev: "PageView",
    noscript: "1",
  });

  res.statusCode = 302;
  res.setHeader("Location", `https://www.facebook.com/tr?${params.toString()}`);
  res.end();
};
