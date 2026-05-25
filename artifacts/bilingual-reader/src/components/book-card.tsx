import { useState } from "react";
import { Link } from "wouter";
import { Book } from "@workspace/api-client-react/src/generated/api.schemas";
import { useDeleteBook, getListBooksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteBookCache } from "@/lib/idb";
import { Trash2, Loader2 } from "lucide-react";
import { BookCoverArt } from "./book-cover-art";

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  pending:     { color: "#9ca3af", label: "Ожидает" },
  in_progress: { color: "#f59e0b", label: "Переводится" },
  completed:   { color: "#10b981", label: "Готово" },
};

export function BookCard({ book }: { book: Book }) {
  const [confirming, setConfirming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const queryClient = useQueryClient();

  const status = (book.translationStatus ?? "pending") as keyof typeof STATUS_DOT;
  const dot = STATUS_DOT[status] ?? STATUS_DOT.pending;

  const progress = book.totalParagraphs > 0
    ? Math.round((book.translatedParagraphs / book.totalParagraphs) * 100)
    : 0;

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

  function handleCancel(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setConfirming(false);
  }

  const card = (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirming(false); }}
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 6,
        overflow: "hidden",
        cursor: "pointer",
        transform: hovered ? "translateY(-6px) scale(1.02)" : "translateY(0) scale(1)",
        transition: "transform 0.22s ease, box-shadow 0.22s ease",
        boxShadow: hovered
          ? "6px 14px 40px rgba(0,0,0,0.38), 2px 4px 12px rgba(0,0,0,0.22)"
          : "3px 6px 18px rgba(0,0,0,0.22), 1px 2px 6px rgba(0,0,0,0.14)",
      }}
    >
      {/* Book spine shadow on left */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 8,
        background: "linear-gradient(to right, rgba(0,0,0,0.35), transparent)",
        zIndex: 2, pointerEvents: "none",
      }} />

      {/* Cover art — 2:3 ratio */}
      <div style={{ aspectRatio: "2/3", width: "100%" }}>
        <BookCoverArt title={book.title} author={book.author} size="md" />
      </div>

      {/* Progress stripe at bottom */}
      {status === "completed" ? null : (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(0,0,0,0.3)" }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#f59e0b", transition: "width 0.4s" }} />
        </div>
      )}

      {/* Status dot */}
      <div style={{
        position: "absolute", top: 8, right: 8,
        width: 8, height: 8, borderRadius: "50%",
        background: dot.color,
        boxShadow: `0 0 6px ${dot.color}`,
        zIndex: 3,
      }} title={dot.label} />

      {/* Delete / confirm overlay — appears on hover */}
      {hovered && !isDeleting && (
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 4,
        }}>
          {!confirming ? (
            <button
              onClick={handleDelete}
              title="Удалить"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: "none", background: "rgba(0,0,0,0.55)",
                color: "rgba(255,255,255,0.7)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                backdropFilter: "blur(4px)",
                transition: "background 0.15s, color 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.85)";
                (e.currentTarget as HTMLElement).style.color = "#fff";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.55)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)";
              }}
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={handleDelete}
                style={{
                  padding: "4px 8px", fontSize: 11, fontWeight: 600,
                  borderRadius: 6, border: "none",
                  background: "rgba(239,68,68,0.9)", color: "#fff",
                  cursor: "pointer", fontFamily: "system-ui, sans-serif",
                }}
              >
                Удалить
              </button>
              <button
                onClick={handleCancel}
                style={{
                  padding: "4px 8px", fontSize: 11, fontWeight: 600,
                  borderRadius: 6, border: "none",
                  background: "rgba(0,0,0,0.55)", color: "#fff",
                  cursor: "pointer", fontFamily: "system-ui, sans-serif",
                  backdropFilter: "blur(4px)",
                }}
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      )}

      {isDeleting && (
        <div style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5,
        }}>
          <Loader2 size={24} color="#fff" style={{ animation: "spin 1s linear infinite" }} />
        </div>
      )}
    </div>
  );

  return (
    <div>
      <Link href={`/reader/${book.id}`} style={{ display: "block", textDecoration: "none" }}>
        {card}
      </Link>
      {/* Book title below cover */}
      <div style={{ marginTop: 10, paddingLeft: 2 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600,
          color: "#1a1a1a", lineHeight: 1.3,
          fontFamily: "Georgia, serif",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {book.title}
        </p>
        {book.author && (
          <p style={{
            margin: "2px 0 0", fontSize: 11, color: "#6b7280",
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {book.author}
          </p>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
