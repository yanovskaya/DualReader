import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Plus, Library } from "lucide-react";
import { cn } from "@/lib/utils";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary/20">
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-5xl h-16 flex items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 transition-colors hover:text-primary">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-serif font-bold text-xl tracking-tight text-primary">Lingua</span>
          </Link>

          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-2 transition-colors hover:text-primary",
                location === "/" ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Library className="h-4 w-4" />
              Library
            </Link>
            <Link
              href="/upload"
              className={cn(
                "flex items-center gap-2 transition-colors hover:text-primary",
                location === "/upload" ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Plus className="h-4 w-4" />
              Add Book
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
}
