(() => {
  async function boot(){
    // Ritorno da una scheda: se il token è scaduto, dopo il login torniamo davvero alla Home.
    try{
      if (new URLSearchParams(window.location.search).get("home") === "1"){
        sessionStorage.setItem("morgedal-return-home","1");
      }
    }catch(e){}

    const redirected = window.morgedalConsumeGoogleRedirect ? window.morgedalConsumeGoogleRedirect() : null;
    if (redirected){
      if (redirected.error){
        if (typeof setAuthGateStatus === "function"){
          setAuthGateStatus("Accesso Google non completato. Ricarica la pagina per riprovare.", true);
        }
        return;
      }

      if (redirected.access_token){
        saveGoogleTokenToSession(redirected.access_token, redirected.expires_in || 3600);
        try{
          const email = await getGoogleEmail(redirected.access_token);
          if (sessionStorage.getItem("morgedal-return-home") === "1"){
            sessionStorage.removeItem("morgedal-return-home");
            history.replaceState(null, "", window.location.pathname + "?home=1");
          }
          routeAuthenticatedUser(email);
        }catch(e){
          try{ sessionStorage.removeItem(GOOGLE_TOKEN_STORAGE_KEY); }catch(_){}
          if (typeof setAuthGateStatus === "function"){
            setAuthGateStatus("Non è stato possibile verificare l'account Google. Ricarica la pagina.", true);
          }
        }
        return;
      }
    }

    if (loadGoogleTokenFromSession()) return;

    if (window.morgedalRedirectToGoogle){
      window.morgedalRedirectToGoogle();
    }
  }

  boot();
})();