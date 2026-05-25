import { type ReactNode, Component, type ErrorInfo } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import UploadPage from "@/pages/upload";
import ReaderPage from "@/pages/reader";
import StatsPage from "@/pages/stats";
import ProcessingPage from "@/pages/processing";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// ── Error Boundary ────────────────────────────────────────────────────────────
interface EBState { hasError: boolean; }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): EBState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", minHeight: "100dvh", gap: 16,
          fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center",
          background: "#FAF8F3", color: "#1a1a1a",
        }}>
          <div style={{ fontSize: 40 }}>📖</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Что-то пошло не так</h1>
          <p style={{ color: "#666", margin: 0, maxWidth: 320 }}>
            Приложение столкнулось с ошибкой. Нажмите кнопку, чтобы обновить страницу.
          </p>
          <button
            onClick={() => window.location.replace("/")}
            style={{
              marginTop: 8, padding: "12px 28px", borderRadius: 10,
              background: "#7c1f2e", color: "#fff", border: "none",
              fontSize: 15, fontWeight: 600, cursor: "pointer",
            }}
          >
            Обновить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
function Routes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/processing/:id" component={ProcessingPage} />
      <Route path="/reader/:id" component={ReaderPage} />
      <Route path="/reader/:id/stats" component={StatsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Routes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
