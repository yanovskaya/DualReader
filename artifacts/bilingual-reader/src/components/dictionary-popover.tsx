import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLookupWord, getLookupWordQueryKey } from "@workspace/api-client-react";
import { Loader2, BookOpen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface DictionaryPopoverProps {
  word: string;
  context?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function DictionaryPopover({ word, context, isOpen, onOpenChange, children }: DictionaryPopoverProps) {
  const cleanWord = word.toLowerCase().replace(/[^\w\s-]/g, "");
  const { data: entry, isLoading, isError } = useLookupWord(
    { word: cleanWord, context },
    { query: { enabled: isOpen && !!word, queryKey: getLookupWordQueryKey({ word: cleanWord, context }) } }
  );

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 shadow-xl border-border/60" 
        align="start" 
        side="bottom"
        sideOffset={8}
      >
        <div className="p-4 bg-muted/30 border-b border-border/40 flex items-center justify-between">
          <h4 className="font-serif font-bold text-lg text-primary">{word.replace(/[^\w\s-]/g, "")}</h4>
          {entry?.partOfSpeech && (
            <span className="text-xs font-mono px-2 py-1 bg-secondary rounded-md text-secondary-foreground">
              {entry.partOfSpeech}
            </span>
          )}
        </div>
        
        <ScrollArea className="max-h-[300px]">
          <div className="p-4 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Looking up...</span>
              </div>
            ) : isError ? (
              <div className="text-sm text-destructive py-2">
                Could not look up word.
              </div>
            ) : entry ? (
              <>
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Translations</h5>
                  <ul className="space-y-1">
                    {entry.translations.map((translation, i) => (
                      <li key={i} className="text-foreground font-medium flex items-start gap-2">
                        <span className="text-muted-foreground text-xs mt-0.5">{i + 1}.</span>
                        {translation}
                      </li>
                    ))}
                  </ul>
                </div>

                {entry.examples && entry.examples.length > 0 && (
                  <>
                    <Separator className="my-2 bg-border/40" />
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Examples</h5>
                      <ul className="space-y-2">
                        {entry.examples.map((example, i) => (
                          <li key={i} className="text-sm text-foreground/80 italic font-serif border-l-2 border-primary/30 pl-3">
                            "{example}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground py-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                No translation found.
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
