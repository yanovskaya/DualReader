import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { ParagraphView } from "@/components/paragraph-view";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  useGetBook, 
  getGetBookQueryKey, 
  useListParagraphs, 
  getListParagraphsQueryKey,
  useGetTranslationStatus,
  getGetTranslationStatusQueryKey
} from "@workspace/api-client-react";
import { Loader2, ChevronLeft, ChevronRight, BarChart3, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data: book, isLoading: isLoadingBook } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) }
  });

  const { data: statusData } = useGetTranslationStatus(bookId, {
    query: { 
      enabled: !!bookId, 
      queryKey: getGetTranslationStatusQueryKey(bookId),
      refetchInterval: (data) => (data?.state?.data?.status === 'in_progress' || data?.state?.data?.status === 'pending') ? 3000 : false
    }
  });

  const { data: paragraphsData, isLoading: isLoadingParagraphs } = useListParagraphs(
    bookId, 
    { page, pageSize },
    { 
      query: { 
        enabled: !!bookId, 
        queryKey: getListParagraphsQueryKey(bookId, { page, pageSize }),
        // Refetch paragraphs if translation is in progress to get newly translated ones
        refetchInterval: statusData?.status === 'in_progress' ? 3000 : false
      } 
    }
  );

  const isInProgress = statusData?.status === 'in_progress' || statusData?.status === 'pending';

  if (isLoadingBook) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!book) {
    return (
      <Layout>
        <div className="container mx-auto max-w-4xl px-4 py-24 text-center">
          <Alert variant="destructive" className="max-w-md mx-auto text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Book not found or could not be loaded.</AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="mt-8">
            <Link href="/">Return to Library</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {isInProgress && (
        <div className="bg-secondary/50 border-b border-border/40 sticky top-16 z-30 backdrop-blur-sm">
          <div className="container mx-auto max-w-5xl px-4 py-3 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs font-medium text-muted-foreground mb-1.5">
                <span>Translating...</span>
                <span>{Math.round(statusData?.progressPercent || 0)}%</span>
              </div>
              <Progress value={statusData?.progressPercent || 0} className="h-1.5" />
            </div>
            <div className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
              {statusData?.translatedParagraphs || 0} / {statusData?.totalParagraphs || 0} paragraphs
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto max-w-5xl px-4 py-12">
        <header className="mb-12 text-center max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary mb-4 leading-tight">
            {book.title}
          </h1>
          {book.author && (
            <p className="text-xl text-muted-foreground font-serif italic">
              by {book.author}
            </p>
          )}
          
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button asChild variant="outline" size="sm" className="rounded-full font-medium shadow-sm hover:bg-primary/5 border-primary/20">
              <Link href={`/reader/${book.id}/stats`} className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Reading Stats
              </Link>
            </Button>
          </div>
        </header>

        <div className="bg-card border border-border/40 rounded-2xl shadow-sm overflow-hidden mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border/40 bg-muted/30">
            <div className="p-4 text-center font-semibold text-sm tracking-widest uppercase text-muted-foreground">
              English Original
            </div>
            <div className="p-4 text-center font-semibold text-sm tracking-widest uppercase text-muted-foreground border-t md:border-t-0 md:border-l border-border/40">
              Russian Translation
            </div>
          </div>
          
          <div className="px-6 md:px-10">
            {isLoadingParagraphs ? (
              <div className="py-24 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              </div>
            ) : paragraphsData?.paragraphs && paragraphsData.paragraphs.length > 0 ? (
              <div className="divide-y divide-border/20">
                {paragraphsData.paragraphs.map(paragraph => (
                  <ParagraphView key={paragraph.id} paragraph={paragraph} />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center text-muted-foreground font-serif italic">
                No paragraphs found.
              </div>
            )}
          </div>
        </div>

        {paragraphsData && paragraphsData.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/40 pt-6">
            <Button 
              variant="outline" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-2 font-medium"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm font-medium text-muted-foreground font-mono">
              Page {page} of {paragraphsData.totalPages}
            </span>
            <Button 
              variant="outline" 
              onClick={() => setPage(p => Math.min(paragraphsData.totalPages, p + 1))}
              disabled={page === paragraphsData.totalPages}
              className="flex items-center gap-2 font-medium"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
