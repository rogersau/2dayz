import { useCallback, useState } from "react";

const DISPLAY_NAME_KEY = "2dayz:display-name";
const SESSION_TOKEN_KEY = "2dayz:session-token";

const readDisplayName = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(DISPLAY_NAME_KEY) ?? "";
};

const readSessionToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const sessionToken = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
  window.localStorage.removeItem(SESSION_TOKEN_KEY);
  return sessionToken;
};

export const useSessionToken = () => {
  const [displayName, setDisplayNameState] = useState(readDisplayName);
  const [sessionToken, setSessionTokenState] = useState<string | null>(readSessionToken);

  const setDisplayName = useCallback((value: string) => {
    setDisplayNameState(value);
    if (typeof window !== "undefined") {
      if (value) {
        window.localStorage.setItem(DISPLAY_NAME_KEY, value);
      } else {
        window.localStorage.removeItem(DISPLAY_NAME_KEY);
      }
    }
  }, []);

  const setSessionToken = useCallback((value: string) => {
    setSessionTokenState(value);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, value);
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, []);

  const clearSessionToken = useCallback(() => {
    setSessionTokenState(null);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, []);

  return {
    clearSessionToken,
    displayName,
    sessionToken,
    setDisplayName,
    setSessionToken,
  };
};
