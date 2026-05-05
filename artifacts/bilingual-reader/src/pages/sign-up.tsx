import { useEffect } from "react";
import { SignUp, useAuth } from "@clerk/react";
import { BookOpen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      navigate("/");
    }
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="container mx-auto max-w-5xl h-16 flex items-center px-4">
          <Link href="/" className="flex items-center gap-2 hover:text-primary transition-colors">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="font-serif font-bold text-xl tracking-tight text-primary">Lingua</span>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-serif font-bold text-primary mb-2">Начать читать</h1>
            <p className="text-muted-foreground">Создайте аккаунт — это бесплатно</p>
          </div>
          <SignUp
            appearance={clerkAppearance}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/"
          />
        </div>
      </div>
    </div>
  );
}
