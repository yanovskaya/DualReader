import { useEffect, useState, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider, useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import UploadPage from "@/pages/upload";
import ReaderPage from "@/pages/reader";
import StatsPage from "@/pages/stats";
import ProcessingPage from "@/pages/processing";
import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

const OFFLINE_AUTH_KEY = "lingua-was-signed-in";

function setOfflineAuth(signedIn: boolean) {
  try {
    if (signedIn) localStorage.setItem(OFFLINE_AUTH_KEY, "1");
    else localStorage.removeItem(OFFLINE_AUTH_KEY);
  } catch {}
}

function getOfflineAuth(): boolean {
  try { return localStorage.getItem(OFFLINE_AUTH_KEY) === "1"; }
  catch { return false; }
}

function ApiTokenInjector() {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    if (isSignedIn) {
      setOfflineAuth(true);
      setAuthTokenGetter(() => getToken());
    } else {
      setOfflineAuth(false);
      setAuthTokenGetter(null);
    }
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);
  return null;
}

function LoadingScreen() {
  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "hsl(42, 33%, 98%)",
      gap: 16,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        width: 28,
        height: 28,
        border: "2.5px solid hsl(353, 50%, 29%)",
        borderTopColor: "transparent",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <span style={{ fontSize: 13, color: "hsl(30, 4%, 55%)", fontFamily: "system-ui, sans-serif" }}>
        Загрузка…
      </span>
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();

  // Offline fallback: if Clerk doesn't respond within 4s and the user
  // has previously signed in, treat them as signed-in (offline mode).
  const [offlineFallback, setOfflineFallback] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => {
      if (getOfflineAuth()) setOfflineFallback(true);
      else navigate("/sign-in");
    }, 4000);
    return () => clearTimeout(t);
  }, [isLoaded, navigate]);

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate("/sign-in");
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded && !offlineFallback) return <LoadingScreen />;
  if (isLoaded && !isSignedIn) return null;
  return <>{children}</>;
}

function Router() {
  return <ApiTokenInjector />;
}

function Routes() {
  return (
    <Switch>
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/">
        <RequireAuth>
          <Home />
        </RequireAuth>
      </Route>
      <Route path="/upload">
        <RequireAuth>
          <UploadPage />
        </RequireAuth>
      </Route>
      <Route path="/processing/:id">
        <RequireAuth>
          <ProcessingPage />
        </RequireAuth>
      </Route>
      <Route path="/reader/:id">
        <RequireAuth>
          <ReaderPage />
        </RequireAuth>
      </Route>
      <Route path="/reader/:id/stats">
        <RequireAuth>
          <StatsPage />
        </RequireAuth>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
            <Routes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
