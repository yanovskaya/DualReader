import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Book {
  id: string;
  title: string;
  author: string;
  language: string;
  content: string;
  paragraphs: Paragraph[];
  totalParagraphs: number;
  createdAt: string;
}

export interface Paragraph {
  id: string;
  position: number;
  originalText: string;
  translatedText: string | null;
  isHeading: boolean;
}

export interface ReadingProgress {
  bookId: string;
  currentPosition: number;
  lastRead: string;
}

interface LibraryContextType {
  books: Book[];
  progress: Record<string, ReadingProgress>;
  addBook: (title: string, author: string, language: string, content: string) => Promise<Book>;
  deleteBook: (id: string) => Promise<void>;
  getBook: (id: string) => Book | undefined;
  saveProgress: (bookId: string, position: number) => Promise<void>;
  getProgress: (bookId: string) => ReadingProgress | undefined;
  isLoaded: boolean;
}

const LibraryContext = createContext<LibraryContextType | null>(null);

const BOOKS_KEY = "@lingua/books";
const PROGRESS_KEY = "@lingua/progress";

function splitIntoParagraphs(content: string): Paragraph[] {
  const lines = content
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return lines.map((line, index) => ({
    id: `p-${Date.now()}-${index}`,
    position: index,
    originalText: line,
    translatedText: null,
    isHeading: line.length < 80 && !line.includes(".") && index === 0,
  }));
}

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [progress, setProgress] = useState<Record<string, ReadingProgress>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [booksJson, progressJson] = await Promise.all([
          AsyncStorage.getItem(BOOKS_KEY),
          AsyncStorage.getItem(PROGRESS_KEY),
        ]);
        if (booksJson) setBooks(JSON.parse(booksJson));
        if (progressJson) setProgress(JSON.parse(progressJson));
      } catch (_) {}
      setIsLoaded(true);
    })();
  }, []);

  const persistBooks = useCallback(async (newBooks: Book[]) => {
    setBooks(newBooks);
    await AsyncStorage.setItem(BOOKS_KEY, JSON.stringify(newBooks));
  }, []);

  const persistProgress = useCallback(async (newProgress: Record<string, ReadingProgress>) => {
    setProgress(newProgress);
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(newProgress));
  }, []);

  const addBook = useCallback(
    async (title: string, author: string, language: string, content: string): Promise<Book> => {
      const paragraphs = splitIntoParagraphs(content);
      const book: Book = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        title,
        author,
        language,
        content,
        paragraphs,
        totalParagraphs: paragraphs.length,
        createdAt: new Date().toISOString(),
      };
      const updated = [...books, book];
      await persistBooks(updated);
      return book;
    },
    [books, persistBooks]
  );

  const deleteBook = useCallback(
    async (id: string) => {
      const updated = books.filter((b) => b.id !== id);
      await persistBooks(updated);
      const newProgress = { ...progress };
      delete newProgress[id];
      await persistProgress(newProgress);
    },
    [books, progress, persistBooks, persistProgress]
  );

  const getBook = useCallback((id: string) => books.find((b) => b.id === id), [books]);

  const saveProgress = useCallback(
    async (bookId: string, position: number) => {
      const updated: Record<string, ReadingProgress> = {
        ...progress,
        [bookId]: { bookId, currentPosition: position, lastRead: new Date().toISOString() },
      };
      await persistProgress(updated);
    },
    [progress, persistProgress]
  );

  const getProgress = useCallback(
    (bookId: string) => progress[bookId],
    [progress]
  );

  return (
    <LibraryContext.Provider
      value={{ books, progress, addBook, deleteBook, getBook, saveProgress, getProgress, isLoaded }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}
