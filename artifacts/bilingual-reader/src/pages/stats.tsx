import { useParams, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useGetBookStats, getGetBookStatsQueryKey, useGetBook, getGetBookQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, BookOpen, Layers, WholeWord, Percent } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function StatsPage() {
  const { id } = useParams<{ id: string }>();
  const bookId = parseInt(id || "0", 10);

  const { data: book } = useGetBook(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookQueryKey(bookId) }
  });

  const { data: stats, isLoading } = useGetBookStats(bookId, {
    query: { enabled: !!bookId, queryKey: getGetBookStatsQueryKey(bookId) }
  });

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8">
          <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3 text-muted-foreground hover:text-foreground">
            <Link href={`/reader/${bookId}`} className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back to Reader
            </Link>
          </Button>
          <h1 className="text-3xl font-serif font-bold text-primary mb-2">Reading Statistics</h1>
          <p className="text-muted-foreground text-lg">
            {book?.title ? `Stats for "${book.title}"` : "Loading..."}
          </p>
        </div>

        {isLoading ? (
          <div className="py-24 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
          </div>
        ) : stats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-border/60 shadow-sm bg-card md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  Translation Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-bold text-foreground">
                      {Math.round(stats.progressPercent)}%
                    </span>
                    <span className="text-sm font-medium text-muted-foreground mb-1">
                      {stats.translatedParagraphs} of {stats.totalParagraphs} paragraphs
                    </span>
                  </div>
                  <Progress value={stats.progressPercent} className="h-3" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                  <Layers className="h-5 w-5 text-primary" />
                  Total Length
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-foreground mb-2">
                  {stats.wordCount.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground font-medium">Estimated English words</p>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                  <WholeWord className="h-5 w-5 text-primary" />
                  Vocabulary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-foreground mb-2">
                  {stats.uniqueWordsLookedUp.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground font-medium">Unique words looked up</p>
              </CardContent>
            </Card>
            
            <div className="md:col-span-2 mt-6 flex justify-center">
              <div className="text-center text-muted-foreground/60 text-sm font-serif italic max-w-lg">
                "To learn a language is to have one more window from which to look at the world."
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground">
            Could not load statistics.
          </div>
        )}
      </div>
    </Layout>
  );
}
