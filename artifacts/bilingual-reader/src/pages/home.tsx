import { useEffect } from "react";
import { useListBooks, getListBooksQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { BookCard } from "@/components/book-card";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Plus, BookOpen } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getLastBook } from "@/hooks/use-reading-progress";

export default function Home() {
  const { data: books, isLoading } = useListBooks({
    query: { queryKey: getListBooksQueryKey() }
  });
  const [, navigate] = useLocation();

  // Auto-navigate: last opened book, or the only book if there's just one
  useEffect(() => {
    if (isLoading || !books) return;
    if (books.length === 0) return;

    const lastId = getLastBook();

    // If there's a saved last book and it still exists → go there
    if (lastId && books.some(b => b.id === lastId)) {
      navigate(`/reader/${lastId}`);
      return;
    }

    // If there's only one book → open it directly
    if (books.length === 1) {
      navigate(`/reader/${books[0].id}`);
    }
  }, [isLoading, books, navigate]);

  return (
    <Layout>
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10 border-b border-border/40 pb-6">
          <div>
            <h1 className="text-4xl font-serif font-bold text-primary mb-2">Библиотека</h1>
            <p className="text-muted-foreground text-lg">Продолжить чтение с последнего места.</p>
          </div>
          <Button asChild size="lg" className="shadow-sm font-medium">
            <Link href="/upload" className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Добавить книгу
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 rounded-xl border border-border/50 p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="pt-4 space-y-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : books && books.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center border-2 border-dashed border-border/60 rounded-2xl bg-card/50">
            <div className="h-20 w-20 bg-primary/5 rounded-full flex items-center justify-center mb-6">
              <BookOpen className="h-10 w-10 text-primary/40" />
            </div>
            <h2 className="text-2xl font-serif font-semibold mb-2">Библиотека пуста</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-8">
              Загрузите книгу, рассказ или статью на английском, чтобы читать с параллельным переводом на русский.
            </p>
            <Button asChild size="lg" variant="outline" className="border-primary/20 hover:bg-primary/5">
              <Link href="/upload" className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Загрузить первую книгу
              </Link>
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
