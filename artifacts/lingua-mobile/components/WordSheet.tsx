import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDictionary, type DictionaryEntry } from "@/context/DictionaryContext";
import { useColors } from "@/hooks/useColors";

interface WordSheetProps {
  word: string | null;
  context?: string;
  onClose: () => void;
}

export function WordSheet({ word, context, onClose }: WordSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { lookup, saveEntry } = useDictionary();
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!word) { setEntry(null); return; }
    const cached = lookup(word);
    if (cached) { setEntry(cached); return; }
    fetchWord(word, context ?? "");
  }, [word]);

  const fetchWord = async (w: string, ctx: string) => {
    setLoading(true);
    setError("");
    setEntry(null);
    try {
      const params = new URLSearchParams({ word: w });
      if (ctx) params.append("context", ctx);
      const res = await fetch(`/api/dictionary/lookup?${params}`);
      if (!res.ok) throw new Error("Ошибка сервера");
      const data: DictionaryEntry = await res.json();
      setEntry(data);
      await saveEntry(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {
      const fallback: DictionaryEntry = {
        word: w,
        translations: ["перевод недоступен — нет подключения к серверу"],
        synonyms: [],
        partOfSpeech: null,
        transcription: null,
        examples: [],
        exampleTranslations: [],
        lookedUpAt: new Date().toISOString(),
      };
      setEntry(fallback);
      setError("Сервер недоступен. Показан офлайн-режим.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={!!word}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.word, { color: colors.primary }]}>{word}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} size="large" />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Ищем перевод...
              </Text>
            </View>
          )}

          {!loading && entry && (
            <View style={styles.content}>
              {entry.transcription && (
                <Text style={[styles.transcription, { color: colors.mutedForeground }]}>
                  {entry.transcription}
                </Text>
              )}
              {entry.partOfSpeech && (
                <View style={[styles.posTag, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.posText, { color: colors.mutedForeground }]}>
                    {entry.partOfSpeech}
                  </Text>
                </View>
              )}

              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ПЕРЕВОДЫ</Text>
                {entry.translations.map((t, i) => (
                  <View key={i} style={styles.translationRow}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <View style={styles.translationTexts}>
                      <Text style={[styles.translation, { color: colors.foreground }]}>{t}</Text>
                      {entry.synonyms[i] && (
                        <Text style={[styles.synonym, { color: colors.mutedForeground }]}>
                          syn: {entry.synonyms[i]}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              {entry.examples.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>ПРИМЕРЫ</Text>
                  {entry.examples.map((ex, i) => (
                    <View key={i} style={[styles.example, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.exampleEn, { color: colors.foreground }]}>{ex}</Text>
                      {entry.exampleTranslations[i] && (
                        <Text style={[styles.exampleRu, { color: colors.mutedForeground }]}>
                          {entry.exampleTranslations[i]}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {error ? (
                <Text style={[styles.errorText, { color: colors.mutedForeground }]}>{error}</Text>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  word: { fontSize: 22, fontFamily: "Inter_700Bold" },
  scroll: { flex: 1 },
  center: { padding: 48, alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  content: { padding: 20, gap: 20 },
  transcription: { fontSize: 16, fontFamily: "Inter_400Regular" },
  posTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  posText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  section: { gap: 10 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  translationRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  translationTexts: { flex: 1, gap: 2 },
  translation: { fontSize: 17, fontFamily: "Inter_500Medium" },
  synonym: { fontSize: 13, fontFamily: "Inter_400Regular" },
  example: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 6,
  },
  exampleEn: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  exampleRu: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, fontStyle: "italic" },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
