import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WordSheet } from "@/components/WordSheet";
import { useDictionary, type DictionaryEntry } from "@/context/DictionaryContext";
import { useColors } from "@/hooks/useColors";

function EntryRow({ entry, onPress }: { entry: DictionaryEntry; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.rowMain}>
        <Text style={[styles.rowWord, { color: colors.foreground }]}>{entry.word}</Text>
        {entry.transcription ? (
          <Text style={[styles.rowTranscription, { color: colors.mutedForeground }]}>
            {entry.transcription}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.rowTranslation, { color: colors.mutedForeground }]} numberOfLines={1}>
        {entry.translations.slice(0, 2).join(", ")}
      </Text>
    </Pressable>
  );
}

export default function DictionaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { recent } = useDictionary();
  const [query, setQuery] = useState("");
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = query.trim()
    ? recent.filter((e) =>
        e.word.toLowerCase().includes(query.toLowerCase().trim())
      )
    : recent;

  const handleSearch = () => {
    const w = query.trim();
    if (w) setSelectedWord(w);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Словарь</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Искать слово..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {filtered.length === 0 && !query ? (
        <View style={styles.empty}>
          <Feather name="book" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Словарь пуст</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Нажимай на слова при чтении — они сохранятся здесь
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.word}
          renderItem={({ item }) => (
            <EntryRow entry={item} onPress={() => setSelectedWord(item.word)} />
          )}
          ListHeaderComponent={
            query.trim() && filtered.length === 0 ? (
              <Pressable style={[styles.searchResult, { backgroundColor: colors.primary }]} onPress={handleSearch}>
                <Text style={[styles.searchResultText, { color: colors.primaryForeground }]}>
                  Найти «{query.trim()}»
                </Text>
                <Feather name="arrow-right" size={16} color={colors.primaryForeground} />
              </Pressable>
            ) : null
          }
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <WordSheet
        word={selectedWord}
        onClose={() => setSelectedWord(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  list: { paddingHorizontal: 16, paddingTop: 4 },
  row: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    gap: 4,
  },
  rowMain: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowWord: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  rowTranscription: { fontSize: 13, fontFamily: "Inter_400Regular" },
  rowTranslation: { fontSize: 14, fontFamily: "Inter_400Regular" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginTop: 8 },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  searchResult: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  searchResultText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
