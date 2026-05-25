import { useEffect, useState } from "react";
import { useListBooks, getListBooksQueryKey } from "@workspace/api-client-react";
import { BookCard } from "@/components/book-card";
import { Link } from "wouter";
import { Plus, WifiOff, BookOpen } from "lucide-react";
import { saveBook, loadAllBooks } from "@/lib/idb";
import type { CachedBook } from "@/lib/idb";

export default function Home() {
  const { data: booksOnline, isLoading: isLoadingOnline } = useListBooks({
    query: { queryKey: getListBooksQueryKey() },
  });
  const [offlineBooks, setOfflineBooks] = useState<CachedBook[]>([]);

  useEffect(() => {
    loadAllBooks().then(books => {
      if (books.length > 0) setOfflineBooks(books);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!booksOnline) return;
    for (const b of booksOnline) {
      saveBook({
        id: b.id,
        title: b.title,
        author: b.author ?? null,
        language: b.language ?? "en",
        totalParagraphs: b.totalParagraphs ?? 0,
        translatedParagraphs: b.translatedParagraphs ?? 0,
        translationStatus: b.translationStatus ?? "pending",
        cachedAt: Date.now(),
      }).catch(() => {});
    }
  }, [booksOnline]);

  const books = booksOnline ?? (offlineBooks.length > 0 ? offlineBooks : undefined);
  const isLoading = isLoadingOnline && !offlineBooks.length;
  const isOffline = !booksOnline && offlineBooks.length > 0;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#F5F0E8",
      backgroundImage: `
        radial-gradient(ellipse at 20% 0%, rgba(139,90,43,0.07) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 100%, rgba(90,60,20,0.05) 0%, transparent 60%)
      `,
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(245,240,232,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(139,90,43,0.12)",
        padding: "0 24px",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={20} color="#7c4f1e" strokeWidth={1.8} />
            <span style={{
              fontSize: 18, fontWeight: 700,
              fontFamily: "Georgia, serif",
              color: "#3d2008", letterSpacing: "0.01em",
            }}>
              Lingua
            </span>
          </div>
          <Link href="/upload" style={{ textDecoration: "none" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#7c4f1e", color: "#fff",
              border: "none", borderRadius: 10,
              padding: "8px 16px", fontSize: 13, fontWeight: 600,
              fontFamily: "system-ui, sans-serif",
              cursor: "pointer",
              boxShadow: "0 2px 8px rgba(124,79,30,0.30)",
            }}>
              <Plus size={15} />
              Добавить книгу
            </button>
          </Link>
        </div>
      </header>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 64px" }}>

        {/* Title */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{
            margin: 0,
            fontSize: 34, fontWeight: 700,
            fontFamily: "Georgia, 'Times New Roman', serif",
            color: "#2a1505",
            letterSpacing: "-0.01em",
          }}>
            Библиотека
          </h1>
          {isOffline && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 10, padding: "5px 12px",
              background: "rgba(139,90,43,0.1)",
              borderRadius: 20, fontSize: 12, color: "#7c4f1e",
              fontFamily: "system-ui, sans-serif",
            }}>
              <WifiOff size={12} />
              Офлайн — показаны кешированные книги
            </div>
          )}
        </div>

        {/* ── Shelf ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          // Skeleton
          <div style={gridStyle}>
            {[1, 2, 3, 4].map(i => (
              <div key={i}>
                <div style={{
                  aspectRatio: "2/3", borderRadius: 6,
                  background: "linear-gradient(135deg, #d8cfc0, #c8bfaf)",
                  animation: "pulse 1.8s ease-in-out infinite",
                }} />
                <div style={{ marginTop: 10, height: 13, borderRadius: 4, background: "#d8cfc0", width: "80%", animation: "pulse 1.8s ease-in-out infinite" }} />
                <div style={{ marginTop: 5, height: 11, borderRadius: 4, background: "#e0d8cc", width: "55%", animation: "pulse 1.8s ease-in-out infinite" }} />
              </div>
            ))}
          </div>
        ) : books && books.length > 0 ? (
          <div style={gridStyle}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {books.map(book => <BookCard key={book.id} book={book as any} />)}

            {/* Add book card */}
            <AddBookCard />
          </div>
        ) : (
          // Empty state
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "80px 24px",
            textAlign: "center",
          }}>
            <div style={gridStyle}>
              <AddBookCard large />
            </div>
            <p style={{
              marginTop: 28, fontSize: 15, color: "#9c856a",
              fontFamily: "system-ui, sans-serif", maxWidth: 320,
            }}>
              Загрузите книгу на английском — читайте с параллельным переводом на русский.
            </p>
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @media (max-width: 500px) {
          .shelf-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 20px 14px !important; }
        }
        @media (min-width: 501px) and (max-width: 760px) {
          .shelf-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (min-width: 761px) and (max-width: 1000px) {
          .shelf-grid { grid-template-columns: repeat(4, 1fr) !important; }
        }
        @media (min-width: 1001px) {
          .shelf-grid { grid-template-columns: repeat(5, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

// ── Shared grid style ─────────────────────────────────────────────────────────

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "32px 24px",
};

// ── Add Book card ─────────────────────────────────────────────────────────────

function AddBookCard({ large }: { large?: boolean }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href="/upload" style={{ textDecoration: "none" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ maxWidth: large ? 160 : undefined }}
      >
        <div style={{
          aspectRatio: "2/3",
          borderRadius: 6,
          border: `2px dashed ${hovered ? "#a07040" : "#c8b89a"}`,
          background: hovered ? "rgba(124,79,30,0.06)" : "rgba(139,90,43,0.03)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 10,
          cursor: "pointer",
          transform: hovered ? "translateY(-4px)" : "translateY(0)",
          transition: "all 0.2s ease",
          boxShadow: hovered ? "3px 8px 24px rgba(0,0,0,0.12)" : "none",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: hovered ? "rgba(124,79,30,0.15)" : "rgba(139,90,43,0.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.2s",
          }}>
            <Plus size={18} color={hovered ? "#7c4f1e" : "#a07848"} />
          </div>
          <span style={{
            fontSize: 11, fontFamily: "system-ui, sans-serif",
            color: hovered ? "#7c4f1e" : "#a07848",
            fontWeight: 600, letterSpacing: "0.04em",
          }}>
            ДОБАВИТЬ
          </span>
        </div>
        <div style={{ height: 13 + 5 + 11, marginTop: 10 }} />
      </div>
    </Link>
  );
}
