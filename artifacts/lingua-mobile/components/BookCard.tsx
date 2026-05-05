import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useLibrary, type Book } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  const colors = useColors();
  const { getProgress, deleteBook } = useLibrary();
  const prog = getProgress(book.id);
  const pct = book.totalParagraphs > 0 && prog
    ? Math.round((prog.currentPosition / book.totalParagraphs) * 100)
    : 0;

  const handleOpen = () => {
    Haptics.selectionAsync();
    router.push(`/reader/${book.id}`);
  };

  const handleDelete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Удалить книгу?", `«${book.title}» будет удалена вместе с прогрессом.`, [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: () => deleteBook(book.id),
      },
    ]);
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={[styles.spine, { backgroundColor: colors.primary }]} />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {book.title}
        </Text>
        {book.author ? (
          <Text style={[styles.author, { color: colors.mutedForeground }]} numberOfLines={1}>
            {book.author}
          </Text>
        ) : null}

        <View style={styles.footer}>
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.primary, width: `${pct}%` },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
              {pct}%
            </Text>
          </View>
          <Text style={[styles.paragraphs, { color: colors.mutedForeground }]}>
            {book.totalParagraphs} абз.
          </Text>
        </View>
      </View>

      <Pressable onPress={handleDelete} style={styles.deleteBtn} hitSlop={8}>
        <Feather name="trash-2" size={16} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    minHeight: 90,
  },
  spine: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  author: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  progressContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    minWidth: 28,
  },
  paragraphs: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  deleteBtn: {
    padding: 14,
    justifyContent: "center",
  },
});
