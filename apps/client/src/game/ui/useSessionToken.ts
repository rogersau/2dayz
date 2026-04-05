import { useCallback, useState } from "react";

const SESSION_TOKEN_KEY = "2dayz:session-token";

const readSessionToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SESSION_TOKEN_KEY);
};

export const useSessionToken = () => {
  const [sessionToken, setSessionTokenState] = useState<string | null>(readSessionToken);

  const setSessionToken = useCallback((value: string) => {
    setSessionTokenState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_TOKEN_KEY, value);
    }
  }, []);

  const clearSessionToken = useCallback(() => {
    setSessionTokenState(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_TOKEN_KEY);
    }
  }, []);

  return {
    clearSessionToken,
    sessionToken,
    setSessionToken,
  };
};
