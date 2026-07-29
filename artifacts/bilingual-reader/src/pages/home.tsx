import { useEffect, useState } from "react";
import { useListBooks, useDeleteBook, getListBooksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, WifiOff, BookOpen, ArrowRight, Clock, ChevronDown, ChevronUp, Trash2, Loader2 } from "lucide-react";
import { saveBook, loadAllBooks, deleteBookCache } from "@/lib/idb";
import { getRecentBookOrder } from "@/hooks/use-reading-progress";
import type { CachedBook } from "@/lib/idb";
import type { Book } from "@workspace/api-client-react/src/generated/api.schemas";
import { BookCoverArt } from "@/components/book-cover-art";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusLabel(status?: string | null) {
  if (status === "completed") return { text: "Переведено", color: "#10b981" };
  if (status === "in_progress") return { text: "Переводится…", color: "#f59e0b" };
  return { text: "Ожидает", color: "#9ca3af" };
}

// ── Book Hero Card ────────────────────────────────────────────────────────────

function BookHeroCard({ book }: { book: Book | CachedBook }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [coverHovered, setCoverHovered] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { mutate: deleteBook, isPending: isDeleting } = useDeleteBook({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() }),
    },
  });

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!confirming) { setConfirming(true); return; }
    deleteBookCache(book.id).catch(() => {});
    deleteBook({ id: book.id });
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setConfirming(false);
  }

  const status = getStatusLabel((book as Book).translationStatus);
  const progress = (book.totalParagraphs ?? 0) > 0
    ? Math.round(((book as Book).translatedParagraphs / book.totalParagraphs!) * 100)
    : 0;

  const coverSrc = useFallback
    ? `/api/books/${book.id}/cover`
    : `/covers/${book.id}.png`;

  const description = (book as Book).description;

  return (
    <article style={{ width: "min(520px, 100%)", margin: "0 auto" }}>

      {/* ── Cover (clickable) ── */}
      <div
        onClick={() => navigate(`/reader/${book.id}`)}
        onMouseEnter={() => setCoverHovered(true)}
        onMouseLeave={() => setCoverHovered(false)}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "2/3",
          maxHeight: "72vh",
          overflow: "hidden",
          borderRadius: 16,
          background: "#1a1a2e",
          cursor: "pointer",
          transform: coverHovered ? "scale(1.012)" : "scale(1)",
          transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94), box-shadow 0.4s ease",
          boxShadow: coverHovered
            ? "0 32px 80px rgba(0,0,0,0.50), 0 8px 24px rgba(0,0,0,0.30)"
            : "0 16px 48px rgba(0,0,0,0.32), 0 4px 12px rgba(0,0,0,0.18)",
        }}
      >
        {/* Cover image */}
        {!imgError && (
          <img
            src={coverSrc}
            alt={book.title}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              if (!useFallback) {
                setUseFallback(true);
                setImgLoaded(false);
              } else {
                setImgError(true);
              }
            }}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              opacity: imgLoaded ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}
          />
        )}

        {/* Gradient CSS cover — fallback */}
        <div style={{
          position: "absolute", inset: 0,
          opacity: imgLoaded && !imgError ? 0 : 1,
          transition: "opacity 0.5s ease",
        }}>
          <BookCoverArt title={book.title} author={(book as Book).author} size="lg" />
        </div>

        {/* Bottom gradient for text legibility */}
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          height: "55%",
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 45%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* Title + author on cover */}
        <div style={{ position: "absolute", left: 24, right: 24, bottom: 24 }}>
          <h2 style={{
            margin: 0,
            fontSize: "clamp(20px,4vw,28px)",
            fontFamily: "Georgia,'Times New Roman',serif",
            fontWeight: 700, color: "#fff", lineHeight: 1.25,
            textShadow: "0 2px 12px rgba(0,0,0,0.6)",
          }}>
            {book.title}
          </h2>
          {(book as Book).author && (
            <p style={{
              margin: "6px 0 0",
              fontSize: "clamp(12px,2.5vw,14px)",
              fontFamily: "system-ui,sans-serif",
              color: "rgba(255,255,255,0.72)",
              letterSpacing: "0.1em", textTransform: "uppercase",
              textShadow: "0 1px 6px rgba(0,0,0,0.5)",
            }}>
              {(book as Book).author}
            </p>
          )}
        </div>

        {/* Status badge */}
        <div style={{
          position: "absolute", top: 16, right: 16,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)",
          borderRadius: 20, padding: "5px 10px",
          display: "flex", alignItems: "center", gap: 5,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: status.color, boxShadow: `0 0 6px ${status.color}`,
          }} />
          <span style={{ fontSize: 11, fontFamily: "system-ui,sans-serif", color: "rgba(255,255,255,0.88)", fontWeight: 500 }}>
            {status.text}
          </span>
        </div>

        {/* Spine shadow */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 12,
          background: "linear-gradient(to right,rgba(0,0,0,0.4),transparent)",
          pointerEvents: "none",
        }} />

        {/* Delete button — top-left, visible on hover */}
        {coverHovered && !isDeleting && (
          <div style={{ position: "absolute", top: 12, left: 14, zIndex: 10 }}>
            {!confirming ? (
              <button
                onClick={handleDelete}
                title="Удалить"
                style={{
                  width: 32, height: 32, borderRadius: 8,
                  border: "none", background: "rgba(0,0,0,0.55)",
                  color: "rgba(255,255,255,0.75)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backdropFilter: "blur(4px)", transition: "background 0.15s, color 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.85)";
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.55)";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)";
                }}
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={handleDelete}
                  style={{
                    padding: "5px 10px", fontSize: 12, fontWeight: 600,
                    borderRadius: 8, border: "none",
                    background: "rgba(239,68,68,0.9)", color: "#fff",
                    cursor: "pointer", fontFamily: "system-ui,sans-serif",
                  }}
                >
                  Удалить
                </button>
                <button
                  onClick={handleCancelDelete}
                  style={{
                    padding: "5px 10px", fontSize: 12, fontWeight: 600,
                    borderRadius: 8, border: "none",
                    background: "rgba(0,0,0,0.55)", color: "#fff",
                    cursor: "pointer", fontFamily: "system-ui,sans-serif",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        )}

        {/* Deleting spinner */}
        {isDeleting && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10,
          }}>
            <Loader2 size={28} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        )}
      </div>

      {/* ── Metadata (outside cover click zone) ── */}
      <div style={{ marginTop: 20, padding: "0 4px" }}>

        {/* Description toggle */}
        {description && (
          <div style={{ marginBottom: 14 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setDescOpen(v => !v); }}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                background: "none", border: "none", padding: "2px 0",
                cursor: "pointer", color: "#9c856a",
                fontSize: 13, fontFamily: "system-ui,sans-serif",
                fontWeight: 500, letterSpacing: "0.02em",
              }}
            >
              О книге
              {descOpen
                ? <ChevronUp size={13} />
                : <ChevronDown size={13} />}
            </button>

            {descOpen && (
              <p style={{
                margin: "8px 0 0",
                fontSize: 14, lineHeight: 1.65,
                color: "#5c4a30",
                fontFamily: "Georgia,serif",
                fontStyle: "italic",
                borderLeft: "2px solid rgba(124,79,30,0.2)",
                paddingLeft: 12,
              }}>
                {description}
              </p>
            )}
          </div>
        )}

        {/* Progress + Read CTA */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            {(book as Book).translationStatus !== "completed" && (book.totalParagraphs ?? 0) > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 80, height: 3, background: "rgba(0,0,0,0.12)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "#f59e0b" }} />
                </div>
                <span style={{ fontSize: 11, color: "#9c856a", fontFamily: "system-ui,sans-serif" }}>
                  {progress}%
                </span>
              </div>
            )}
            {(book as Book).translationStatus === "completed" && (
              <span style={{ fontSize: 11, color: "#10b981", fontFamily: "system-ui,sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                <Clock size={11} /> Готово к чтению
              </span>
            )}
          </div>

          <Link href={`/reader/${book.id}`} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(124,79,30,0.12)", color: "#7c4f1e",
              padding: "8px 16px", borderRadius: 30,
              fontSize: 13, fontWeight: 600, fontFamily: "system-ui,sans-serif",
            }}>
              Читать <ArrowRight size={14} />
            </div>
          </Link>
        </div>
      </div>
    </article>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────

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
        id: b.id, title: b.title, author: b.author ?? null,
        language: b.language ?? "en",
        totalParagraphs: b.totalParagraphs ?? 0,
        translatedParagraphs: b.translatedParagraphs ?? 0,
        translationStatus: b.translationStatus ?? "pending",
        cachedAt: Date.now(),
      }).catch(() => {});
    }
  }, [booksOnline]);

  const recentOrder = getRecentBookOrder();
  const sortByRecent = <T extends { id: number }>(list: T[]): T[] => {
    if (recentOrder.length === 0) return list;
    const rank = new Map(recentOrder.map((id, i) => [id, i]));
    return [...list].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Infinity;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Infinity;
      return ra - rb;
    });
  };
  const books = booksOnline
    ? sortByRecent(booksOnline)
    : offlineBooks.length > 0
    ? sortByRecent(offlineBooks)
    : undefined;
  const isLoading = isLoadingOnline && !offlineBooks.length;
  const isOffline = !booksOnline && offlineBooks.length > 0;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#F4EFE6",
      backgroundImage: "radial-gradient(ellipse at 50% 0%,rgba(139,90,43,0.08) 0%,transparent 70%)",
    }}>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(244,239,230,0.90)", backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(139,90,43,0.10)",
      }}>
        <div style={{
          maxWidth: 640, margin: "0 auto",
          height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 24px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BookOpen size={19} color="#7c4f1e" strokeWidth={1.8} />
            <span style={{ fontSize: 17, fontWeight: 700, fontFamily: "Georgia,serif", color: "#3d2008" }}>
              Lingua
            </span>
          </div>
          <Link href="/upload" style={{ textDecoration: "none" }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "#7c4f1e", color: "#fff",
              border: "none", borderRadius: 24,
              padding: "8px 18px", fontSize: 13, fontWeight: 600,
              fontFamily: "system-ui,sans-serif", cursor: "pointer",
              boxShadow: "0 2px 10px rgba(124,79,30,0.28)",
            }}>
              <Plus size={15} /> Книга
            </button>
          </Link>
        </div>
      </header>

      {isOffline && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          padding: "8px 16px", background: "rgba(139,90,43,0.10)",
          fontSize: 12, color: "#7c4f1e", fontFamily: "system-ui,sans-serif",
        }}>
          <WifiOff size={12} /> Офлайн — кешированные книги
        </div>
      )}

      <main style={{ padding: "40px 24px 80px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto 44px", textAlign: "center" }}>
          <h1 style={{
            margin: 0, fontSize: "clamp(28px,6vw,42px)",
            fontFamily: "Georgia,'Times New Roman',serif",
            fontWeight: 700, color: "#2a1505", letterSpacing: "-0.02em",
          }}>
            Библиотека
          </h1>
          {!isLoading && books && books.length > 0 && (
            <p style={{ margin: "10px 0 0", fontSize: 15, color: "#9c856a", fontFamily: "system-ui,sans-serif" }}>
              {books.length === 1 ? "1 книга" : `${books.length} книги`}
            </p>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 56 }}>
            {[1, 2].map(i => (
              <div key={i} style={{ width: "min(520px,100%)", margin: "0 auto" }}>
                <div style={{
                  aspectRatio: "2/3", maxHeight: "72vh", borderRadius: 16,
                  background: "linear-gradient(135deg,#d8cfc0,#c8bfaf)",
                  animation: "pulse 1.8s ease-in-out infinite",
                }} />
                <div style={{ marginTop: 20, height: 36, borderRadius: 8, background: "#d8cfc0", width: "60%", animation: "pulse 1.8s ease-in-out infinite" }} />
              </div>
            ))}
          </div>
        ) : books && books.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {books.map(book => <BookHeroCard key={book.id} book={book as any} />)}
            <AddBookHero />
          </div>
        ) : (
          <AddBookHero empty />
        )}
      </main>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>

      <footer style={{ textAlign: "right", padding: "8px 16px 12px" }}>
        <span style={{ fontSize: 11, color: "rgba(0,0,0,0.25)", fontFamily: "monospace", userSelect: "none" }}>
          build {new Date(__BUILD_TIME__).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
      </footer>
    </div>
  );
}

// ── Add Book Hero ─────────────────────────────────────────────────────────────

function AddBookHero({ empty }: { empty?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link href="/upload" style={{ display: "block", textDecoration: "none" }}>
      <article
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ width: "min(520px,100%)", margin: "0 auto", cursor: "pointer" }}
      >
        <div style={{
          width: "100%",
          aspectRatio: "2/3",
          maxHeight: empty ? "72vh" : "44vh",
          borderRadius: 16,
          border: `2px dashed ${hovered ? "#a07040" : "#c4b09a"}`,
          background: hovered ? "rgba(124,79,30,0.05)" : "transparent",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 14,
          transition: "border-color 0.25s ease, background 0.25s ease",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            background: hovered ? "rgba(124,79,30,0.12)" : "rgba(139,90,43,0.07)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "background 0.25s ease",
          }}>
            <Plus size={22} color={hovered ? "#7c4f1e" : "#a07848"} />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{
              margin: 0, fontSize: 15, fontWeight: 600,
              color: hovered ? "#7c4f1e" : "#a07848",
              fontFamily: "Georgia,serif",
            }}>
              {empty ? "Добавьте первую книгу" : "Добавить книгу"}
            </p>
            {empty && (
              <p style={{ margin: "6px 0 0", fontSize: 13, color: hovered ? "#9c6030" : "#b8976a", fontFamily: "system-ui,sans-serif" }}>
                Загрузите .txt или .epub файл
              </p>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
