import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, X, BookOpen } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.match(/\.(txt|epub)$/i)) {
      toast({ title: "Unsupported file type", description: "Please upload a .txt or .epub file.", variant: "destructive" });
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.(txt|epub)$/i, "").replace(/[-_]/g, " "));
    }
  }, [title, toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, [handleFile]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setUploadStatus("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title.trim()) formData.append("title", title.trim());
      if (author.trim()) formData.append("author", author.trim());

      const uploadRes = await fetch("/api/books/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error ?? "Upload failed");
      }

      const book = await uploadRes.json();

      setUploadStatus("Starting translation...");

      // Kick off translation in the background (SSE stream — we don't wait for it)
      fetch(`/api/books/${book.id}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 8 }),
      }).catch(() => {});

      toast({ title: "Книга загружена", description: "Перевод запущен. Дождитесь завершения — книга будет доступна офлайн." });
      setLocation(`/processing/${book.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      // "Load failed" (Safari) / "Failed to fetch" (Chrome) means the network
      // request was interrupted by the Service Worker taking over — but the
      // server likely processed the upload already. Send the user to the
      // library so they can see their book.
      const isSwInterrupt = msg === "Load failed" || msg === "Failed to fetch";
      if (isSwInterrupt) {
        toast({
          title: "Возможно, книга уже загружена",
          description: "Соединение прервалось, но книга могла сохраниться. Проверьте библиотеку.",
        });
        setLocation("/");
      } else {
        toast({
          title: "Upload failed",
          description: msg,
          variant: "destructive",
        });
        setIsUploading(false);
        setUploadStatus("");
      }
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-serif font-bold text-primary mb-3">Upload a Book</h1>
          <p className="text-muted-foreground text-lg">Upload a TXT or EPUB file — the app will translate it into Russian automatically.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-2xl transition-all
              ${file ? "border-primary/40 bg-primary/5 cursor-default" : "cursor-pointer hover:border-primary/50 hover:bg-muted/40"}
              ${isDragging ? "border-primary bg-primary/10 scale-[1.01]" : "border-border"}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.epub"
              onChange={onFileChange}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center gap-4 p-6">
                <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                <div className="h-16 w-16 bg-muted rounded-2xl flex items-center justify-center mb-5">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-foreground mb-1">
                  {isDragging ? "Drop your file here" : "Drop your file here or click to browse"}
                </p>
                <p className="text-sm text-muted-foreground">Supported formats: .txt, .epub</p>
              </div>
            )}
          </div>

          {/* Optional metadata */}
          {file && (
            <Card className="border-border/50">
              <CardContent className="pt-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Title</label>
                  <Input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Book title"
                    className="bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Author <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input
                    value={author}
                    onChange={e => setAuthor(e.target.value)}
                    placeholder="Author name"
                    className="bg-background"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full text-base font-medium h-13"
            disabled={!file || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {uploadStatus || "Uploading..."}
              </>
            ) : (
              <>
                <BookOpen className="mr-2 h-5 w-5" />
                Upload & Start Translation
              </>
            )}
          </Button>

          {file && !isUploading && (
            <p className="text-center text-sm text-muted-foreground">
              После загрузки дождитесь окончания перевода — потом книга будет доступна офлайн.
            </p>
          )}
        </form>
      </div>
    </Layout>
  );
}
