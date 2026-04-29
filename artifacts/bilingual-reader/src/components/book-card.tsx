import { Link } from "wouter";
import { Book } from "@workspace/api-client-react/src/generated/api.schemas";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

export function BookCard({ book }: { book: Book }) {
  const progress = book.totalParagraphs > 0 
    ? Math.round((book.translatedParagraphs / book.totalParagraphs) * 100) 
    : 0;

  const statusColors = {
    pending: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    in_progress: "bg-primary text-primary-foreground hover:bg-primary/90",
    completed: "bg-accent text-accent-foreground hover:bg-accent/80",
  };

  const statusLabels = {
    pending: "Pending",
    in_progress: "Translating",
    completed: "Ready",
  };

  return (
    <Link href={`/reader/${book.id}`}>
      <Card className="h-full flex flex-col hover-elevate transition-all duration-300 border-border/50 bg-card hover:border-primary/30 cursor-pointer overflow-hidden group">
        <CardHeader className="pb-3 gap-2">
          <div className="flex justify-between items-start gap-4">
            <div>
              <h3 className="font-serif font-semibold text-xl leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {book.title}
              </h3>
              {book.author && (
                <p className="text-sm text-muted-foreground mt-1 font-medium">{book.author}</p>
              )}
            </div>
            <Badge className={statusColors[book.translationStatus]} variant="secondary">
              {statusLabels[book.translationStatus]}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 pb-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{book.language || "English"}</span>
              <span>{progress}% Translated</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </CardContent>
        
        <CardFooter className="pt-0 text-xs text-muted-foreground border-t border-border/40 pt-3">
          Added {format(new Date(book.createdAt), "MMM d, yyyy")}
        </CardFooter>
      </Card>
    </Link>
  );
}
