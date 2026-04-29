import { useState } from "react";
import { Paragraph } from "@workspace/api-client-react/src/generated/api.schemas";
import { DictionaryPopover } from "./dictionary-popover";
import { cn } from "@/lib/utils";

interface ParagraphViewProps {
  paragraph: Paragraph;
}

export function ParagraphView({ paragraph }: ParagraphViewProps) {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);

  // Split text into words while preserving punctuation
  const words = paragraph.originalText.match(/[\w'-]+|[^\w\s]+|\s+/g) || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 py-6 border-b border-border/20 last:border-0 group">
      <div className="text-lg leading-relaxed font-serif text-foreground">
        {words.map((token, index) => {
          const isWord = /[\w'-]+/.test(token);
          const id = `${paragraph.id}-${index}`;
          
          if (!isWord) {
            return <span key={id}>{token}</span>;
          }

          return (
            <DictionaryPopover 
              key={id} 
              word={token} 
              context={paragraph.originalText}
              isOpen={selectedWordId === id}
              onOpenChange={(open) => setSelectedWordId(open ? id : null)}
            >
              <span 
                className={cn(
                  "cursor-pointer transition-colors rounded-sm",
                  selectedWordId === id 
                    ? "bg-primary/20 text-primary underline underline-offset-4 decoration-primary/50 decoration-2" 
                    : "hover:bg-primary/10 hover:text-primary"
                )}
                onClick={() => setSelectedWordId(id)}
              >
                {token}
              </span>
            </DictionaryPopover>
          );
        })}
      </div>
      
      <div className={cn(
        "text-lg leading-relaxed font-serif",
        paragraph.isTranslated ? "text-foreground/90" : "text-muted-foreground italic"
      )}>
        {paragraph.isTranslated ? (
          paragraph.translatedText
        ) : (
          <span className="flex items-center gap-2 opacity-50">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse delay-150" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse delay-300" />
          </span>
        )}
      </div>
    </div>
  );
}
