(() => {
  const REDIRECT_URI = "https://mariodevincenzodnd-blip.github.io/Morgedal-2/";
  const STATE_KEY = "morgedal-oauth-state";

  function randomState(){
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join("");
  }

  window.morgedalRedirectToGoogle = function(){
    const state = randomState();
    sessionStorage.setItem(STATE_KEY, state);

    const endpoint = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    endpoint.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    endpoint.searchParams.set("redirect_uri", REDIRECT_URI);
    endpoint.searchParams.set("response_type", "token");
    endpoint.searchParams.set("scope", DRIVE_SCOPE);
    endpoint.searchParams.set("include_granted_scopes", "true");
    endpoint.searchParams.set("prompt", "select_account");
    endpoint.searchParams.set("state", state);
    window.location.replace(endpoint.toString());
  };

  window.morgedalConsumeGoogleRedirect = function(){
    if (!window.location.hash || window.location.hash.length < 2) return null;
    const p = new URLSearchParams(window.location.hash.slice(1));
    if (!p.has("access_token") && !p.has("error")) return null;

    const expected = sessionStorage.getItem(STATE_KEY) || "";
    sessionStorage.removeItem(STATE_KEY);
    const returned = p.get("state") || "";

    history.replaceState(null, "", window.location.pathname + window.location.search);

    if (p.get("error")) return { error:p.get("error") };
    if (!expected || expected !== returned) return { error:"state_mismatch" };

    return {
      access_token:p.get("access_token"),
      expires_in:Number(p.get("expires_in") || 3600)
    };
  };
})();