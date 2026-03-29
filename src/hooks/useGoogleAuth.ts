import { useState, useEffect } from 'react';

// window.google 型定義のための簡易hack
declare global {
  interface Window {
    google: any;
  }
}

export function useGoogleAuth(clientId: string) {
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    
    // Check if the GIS script is loaded
    const checkGoogle = setInterval(() => {
      if (window.google && window.google.accounts) {
        setIsReady(true);
        clearInterval(checkGoogle);
      }
    }, 100);

    return () => clearInterval(checkGoogle);
  }, [clientId]);

  const login = () => {
    if (!window.google) {
      console.error("Google script not loaded");
      return;
    }
    
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/documents.readonly',
      callback: (response: any) => {
        if (response.error) {
          console.error('Google Auth Error:', response);
          return;
        }
        setToken(response.access_token);
      },
    });
    client.requestAccessToken();
  };

  const logout = () => {
    if (token) {
      window.google?.accounts.oauth2.revoke(token, () => {
        setToken(null);
      });
    }
  };

  return { token, isReady, login, logout };
}
