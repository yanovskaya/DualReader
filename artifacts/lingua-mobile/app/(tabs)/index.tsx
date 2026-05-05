import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddBookSheet } from "@/components/AddBookSheet";
import { BookCard } from "@/components/BookCard";
import { useLibrary } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

export default function LibraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, isLoaded } = useLibrary();
  const [showAdd, setShowAdd] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.appName, { color: colors.primary }]}>Lingua</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {books.length > 0 ? `${books.length} ${books.length === 1 ? "книга" : books.length < 5 ? "книги" : "книг"}` : "Твоя библиотека"}
          </Text>
        </View>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => { Haptics.selectionAsync(); setShowAdd(true); }}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {isLoaded && books.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="book-open" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Библиотека пуста</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Добавь книгу — вставь текст или загрузи TXT-файл
          </Text>
          <Pressable
            style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            onPress={() => { Haptics.selectionAsync(); setShowAdd(true); }}
          >
            <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
              Добавить первую книгу
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={books}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BookCard book={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!books.length}
        />
      )}

      <AddBookSheet visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  appName: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16 },
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
  emptyBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
