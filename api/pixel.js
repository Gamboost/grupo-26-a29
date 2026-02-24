module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Metodo no permitido." });
    return;
  }

  const pixelId =
    typeof process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID === "string"
      ? process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID.trim()
      : "";

  res.status(200).json({ pixelId });
};
