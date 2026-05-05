import { useEffect, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
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

function ApiTokenInjector() {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    if (isSignedIn) {
      setAuthTokenGetter(() => getToken());
    } else {
      setAuthTokenGetter(null);
    }
    return () => setAuthTokenGetter(null);
  }, [getToken, isSignedIn]);
  return null;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      navigate("/sign-in");
    }
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded) return null;
  if (!isSignedIn) return null;
  return <>{children}</>;
}

function Router() {
  return (
    <ApiTokenInjector />
  );
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
