const ALLOWED_ORIGIN = "https://mariodevincenzodnd-blip.github.io";
const REDIRECT_URI = "https://mariodevincenzodnd-blip.github.io/Morgedal-2/";

const AUTHORIZED_EMAILS = new Set([
  "mariodevincenzodnd@gmail.com",
  "genchi.walter@gmail.com",
  "dray1286@gmail.com",
  "nicoladmn@gmail.com",
  "ivandevincenzo18052005@gmail.com",
  "rocco.scotellaro93@gmail.com",
  "manudegiorgi999@gmail.com",
  "savimusciagna@gmail.com",
  "markogiga25@gmail.com",
  "jigenmail98@gmail.com",
  "pabloderubautenze@gmail.com",
  "pabloderuba@gmail.com",
  "marinanapoletano1998@gmail.com",
  "annamaria.romanocyr@gmail.com"
]);

function applyCors(req, res) {
  const origin = req.headers.origin || "";
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const origin = req.headers.origin || "";
  if (origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: "origin_not_allowed" });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "oauth_server_not_configured" });
  }

  const { code, code_verifier: codeVerifier } = req.body || {};

  if (
    typeof code !== "string" ||
    !code ||
    typeof codeVerifier !== "string" ||
    codeVerifier.length < 43 ||
    codeVerifier.length > 128
  ) {
    return res.status(400).json({ error: "invalid_request" });
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code_verifier: codeVerifier
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return res.status(401).json({
        error: "token_exchange_failed",
        detail: tokenData.error || "unknown_error"
      });
    }

    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: "Bearer " + tokenData.access_token }
    });

    const user = await userResponse.json();
    const email = String(user && user.email || "").toLowerCase();

    if (!userResponse.ok || !user.email_verified || !AUTHORIZED_EMAILS.has(email)) {
      return res.status(403).json({ error: "account_not_authorized" });
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      expires_in: Number(tokenData.expires_in || 3600),
      token_type: tokenData.token_type || "Bearer",
      email
    });
  } catch (error) {
    return res.status(500).json({ error: "oauth_exchange_error" });
  }
}
