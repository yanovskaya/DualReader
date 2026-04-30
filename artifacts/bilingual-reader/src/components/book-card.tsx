import { useState } from "react";
import { Link } from "wouter";
import { Book } from "@workspace/api-client-react/src/generated/api.schemas";
import { useDeleteBook, getListBooksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export function BookCard({ book }: { book: Book }) {
  const [confirming, setConfirming] = useState(false);
  const queryClient = useQueryClient();

  const progress = book.totalParagraphs > 0
    ? Math.round((book.translatedParagraphs / book.totalParagraphs) * 100)
    : 0;

  type Status = "pending" | "in_progress" | "completed";
  const status = (book.translationStatus ?? "pending") as Status;

  const statusLabels: Record<Status, string> = {
    pending: "Ожидает",
    in_progress: "Переводится",
    completed: "Готово",
  };

  const statusColors: Record<Status, { bg: string; text: string }> = {
    pending:     { bg: "#e5e7eb", text: "#6b7280" },
    in_progress: { bg: "#d1fae5", text: "#065f46" },
    completed:   { bg: "#d1fae5", text: "#059669" },
  };

  const sc = statusColors[status];

  const { mutate: deleteBook, isPending: isDeleting } = useDeleteBook({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBooksQueryKey() });
      },
    },
  });

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(true);
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  }

  function handleConfirmDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    deleteBook({ id: book.id });
  }

  const card = (
    <div style={{
      position: "relative",
      borderRadius: 16,
      border: confirming ? "1.5px solid #ef4444" : "1.5px solid rgba(0,0,0,0.09)",
      background: "#fff",
      overflow: "hidden",
      transition: "border-color 0.2s, box-shadow 0.2s",
      boxShadow: confirming ? "0 0 0 3px rgba(239,68,68,0.10)" : "0 1px 4px rgba(0,0,0,0.06)",
      cursor: confirming ? "default" : "pointer",
    }}>

      {/* Main card content (wrapped in Link only when not confirming) */}
      <div style={{ padding: "18px 18px 14px" }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{
              margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.3,
              color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {book.title}
            </h3>
            {book.author && (
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
                {book.author}
              </p>
            )}
          </div>

          {/* Status badge */}
          <span style={{
            flexShrink: 0, fontSize: 11, fontWeight: 600, borderRadius: 20,
            padding: "3px 9px", background: sc.bg, color: sc.text, whiteSpace: "nowrap",
          }}>
            {statusLabels[status]}
          </span>
        </div>

        {/* Progress */}
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
            <span>{book.language || "English"}</span>
            <span>{progress}% перевод</span>
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: "#059669", borderRadius: 2, transition: "width 0.3s" }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>
            {format(new Date(book.createdAt), "d MMM yyyy")}
          </span>

          {/* Delete button */}
          {!confirming && (
            <button
              onClick={handleDeleteClick}
              title="Удалить книгу"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 28, height: 28, borderRadius: 8, border: "none",
                background: "transparent", cursor: "pointer", color: "#d1d5db",
                transition: "background 0.15s, color 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "#fee2e2";
                (e.currentTarget as HTMLElement).style.color = "#ef4444";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "#d1d5db";
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Confirm overlay */}
      {confirming && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", inset: 0,
            background: "rgba(255,255,255,0.97)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 14, padding: 20,
            borderRadius: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={18} color="#ef4444" />
            <span style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>Удалить книгу?</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 1.4 }}>
            «{book.title}» и весь перевод будут удалены. Это нельзя отменить.
          </p>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              onClick={handleCancelDelete}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                border: "1.5px solid rgba(0,0,0,0.12)", background: "#fff",
                cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#374151",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff"; }}
            >
              Отмена
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 10,
                border: "none", background: isDeleting ? "#fca5a5" : "#ef4444",
                cursor: isDeleting ? "default" : "pointer",
                fontSize: 14, fontWeight: 600, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { if (!isDeleting) (e.currentTarget as HTMLElement).style.background = "#dc2626"; }}
              onMouseLeave={e => { if (!isDeleting) (e.currentTarget as HTMLElement).style.background = "#ef4444"; }}
            >
              {isDeleting ? (
                <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Удаление…</>
              ) : (
                <><Trash2 size={14} /> Удалить</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Wrap with Link only when not in confirm state
  if (confirming || isDeleting) {
    return card;
  }

  return (
    <Link href={`/reader/${book.id}`} style={{ display: "block", textDecoration: "none" }}>
      {card}
    </Link>
  );
}
