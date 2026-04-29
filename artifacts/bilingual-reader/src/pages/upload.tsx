import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateBook, useStartTranslation } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, BookText } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  content: z.string().min(50, "Text content is too short (minimum 50 characters)"),
});

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createBook = useCreateBook();
  const startTranslation = useStartTranslation();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      author: "",
      content: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const book = await createBook.mutateAsync({
        data: {
          title: values.title,
          author: values.author || undefined,
          content: values.content,
          language: "English",
        }
      });

      // Start translation process
      // This kicks off the SSE process on the server
      fetch(`/api/books/${book.id}/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batchSize: 5 })
      }).catch(console.error);

      toast({
        title: "Book uploaded successfully",
        description: "Translation has started. Redirecting to reader...",
      });

      setLocation(`/reader/${book.id}`);
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error uploading your book. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="container mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold text-primary mb-2">Add New Book</h1>
          <p className="text-muted-foreground text-lg">Paste English text to read with parallel Russian translation.</p>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="bg-muted/20 border-b border-border/40">
            <CardTitle className="flex items-center gap-2">
              <BookText className="h-5 w-5 text-primary" />
              Book Details
            </CardTitle>
            <CardDescription>Enter the metadata and paste the full text content.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. The Great Gatsby" className="bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="author"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Author (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. F. Scott Fitzgerald" className="bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Text Content</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Paste the full English text here..." 
                          className="min-h-[400px] font-serif leading-relaxed resize-y bg-background" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full sm:w-auto font-medium shadow-sm"
                    disabled={createBook.isPending}
                  >
                    {createBook.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Uploading & Translating...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-5 w-5" />
                        Upload & Translate
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
