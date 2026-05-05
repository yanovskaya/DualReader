import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WordSheet } from "@/components/WordSheet";
import { useLibrary, type Paragraph } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

function ParagraphView({
  paragraph,
  showTranslation,
  onWordPress,
}: {
  paragraph: Paragraph;
  showTranslation: boolean;
  onWordPress: (word: string, context: string) => void;
}) {
  const colors = useColors();

  const words = paragraph.originalText.split(/\s+/);

  if (paragraph.isHeading) {
    return (
      <View style={styles.headingContainer}>
        <Text style={[styles.heading, { color: colors.primary }]}>
          {paragraph.originalText}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.paragraphContainer}>
      <View style={styles.wordWrap}>
        {words.map((word, i) => {
          const clean = word.replace(/[^a-zA-Z'-]/g, "");
          return (
            <Pressable
              key={i}
              onPress={() => {
                if (clean.length > 2) {
                  Haptics.selectionAsync();
                  onWordPress(clean.toLowerCase(), paragraph.originalText);
                }
              }}
              hitSlop={2}
            >
              <Text style={[styles.word, { color: colors.serifText }]}>{word} </Text>
            </Pressable>
          );
        })}
      </View>

      {showTranslation && paragraph.translatedText && (
        <View style={[styles.translation, { backgroundColor: colors.translationBg, borderColor: colors.translationBorder }]}>
          <Text style={[styles.translationText, { color: colors.serifMuted }]}>
            {paragraph.translatedText}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getBook, saveProgress, getProgress } = useLibrary();
  const book = getBook(id);

  const [showTranslation, setShowTranslation] = useState(true);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [selectedContext, setSelectedContext] = useState("");
  const listRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!book) return;
    const prog = getProgress(book.id);
    if (prog && prog.currentPosition > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: Math.min(prog.currentPosition, book.paragraphs.length - 1),
          animated: false,
        });
      }, 300);
    }
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (!book || viewableItems.length === 0) return;
      const last = viewableItems[viewableItems.length - 1];
      if (last.index !== null) saveProgress(book.id, last.index);
    },
    [book, saveProgress]
  );

  if (!book) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const progress = getProgress(book.id);
  const pct = progress && book.totalParagraphs > 0
    ? Math.round((progress.currentPosition / book.totalParagraphs) * 100)
    : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {book.title}
          </Text>
          <Text style={[styles.headerProgress, { color: colors.mutedForeground }]}>
            {pct}%
          </Text>
        </View>
        <Pressable
          onPress={() => setShowTranslation((v) => !v)}
          style={[
            styles.toggleBtn,
            { borderColor: colors.border, backgroundColor: showTranslation ? colors.primary : "transparent" },
          ]}
          hitSlop={8}
        >
          <Feather
            name="align-left"
            size={16}
            color={showTranslation ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${pct}%` }]} />
      </View>

      <FlatList
        ref={listRef}
        data={book.paragraphs}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <ParagraphView
            paragraph={item}
            showTranslation={showTranslation}
            onWordPress={(word, ctx) => {
              setSelectedWord(word);
              setSelectedContext(ctx);
            }}
          />
        )}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        onScrollToIndexFailed={() => {}}
      />

      <WordSheet
        word={selectedWord}
        context={selectedContext}
        onClose={() => setSelectedWord(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerProgress: { fontSize: 12, fontFamily: "Inter_400Regular" },
  toggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBar: { height: 2 },
  progressFill: { height: 2 },
  content: { paddingHorizontal: 20, paddingTop: 24 },
  headingContainer: { marginBottom: 20, marginTop: 8 },
  heading: { fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 28 },
  paragraphContainer: { marginBottom: 20, gap: 8 },
  wordWrap: { flexDirection: "row", flexWrap: "wrap" },
  word: { fontSize: 17, fontFamily: "Inter_400Regular", lineHeight: 28 },
  translation: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  translationText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
    fontStyle: "italic",
  },
});
