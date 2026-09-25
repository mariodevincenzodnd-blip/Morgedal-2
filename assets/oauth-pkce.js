(() => {
  const REDIRECT_URI = "https://mariodevincenzodnd-blip.github.io/Morgedal-2/";
  const EXCHANGE_URL = "__MORGEDAL_AUTH_EXCHANGE_URL__";
  const PKCE_VERIFIER_KEY = "morgedal-pkce-verifier";
  const OAUTH_STATE_KEY = "morgedal-oauth-state";

  function base64Url(bytes) {
    let binary = "";
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function randomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  async function sha256(text) {
    return new Uint8Array(await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    ));
  }

  window.morgedalStartGooglePkce = async function() {
    const verifier = base64Url(randomBytes(64));
    const challenge = base64Url(await sha256(verifier));
    const state = base64Url(randomBytes(32));

    sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
    sessionStorage.setItem(OAUTH_STATE_KEY, state);

    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    auth.searchParams.set("redirect_uri", REDIRECT_URI);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("scope", DRIVE_SCOPE);
    auth.searchParams.set("include_granted_scopes", "true");
    auth.searchParams.set("prompt", "select_account");
    auth.searchParams.set("code_challenge", challenge);
    auth.searchParams.set("code_challenge_method", "S256");
    auth.searchParams.set("state", state);

    window.location.replace(auth.toString());
  };

  window.morgedalConsumeGooglePkceReturn = async function() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const returnedState = params.get("state");
    const error = params.get("error");

    if (!code && !error) return null;

    const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY) || "";
    const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY) || "";

    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(PKCE_VERIFIER_KEY);

    if (error) return { error };
    if (!code || !verifier || !expectedState || returnedState !== expectedState) {
      return { error: "oauth_state_invalid" };
    }

    const response = await fetch(EXCHANGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier })
    });

    const data = await response.json();
    if (!response.ok) return { error: data.error || "exchange_failed" };

    return data;
  };
})();