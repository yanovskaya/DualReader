import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLibrary } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

interface AddBookSheetProps {
  visible: boolean;
  onClose: () => void;
}

const SAMPLE_TEXT = `The Project Gutenberg eBook of Pride and Prejudice

It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.

However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.

"My dear Mr. Bennet," said his lady to him one day, "have you heard that Netherfield Park is let at last?"

Mr. Bennet replied that he had not.

"But it is," returned she; "for Mrs. Long has just been here, and she told me all about it."

Mr. Bennet made no answer.

"Do you not want to know who has taken it?" cried his wife impatiently.

"You want to tell me, and I have no objection to hearing it."

This was invitation enough.

"Why, my dear, you must know, Mrs. Long says that Netherfield is taken by a young man of large fortune from the north of England; that he came down on Monday in a chaise and four to see the place, and was so much delighted with it, that he agreed with Mr. Morris immediately; that he is to take possession before Michaelmas, and some of his servants are to be in the house by the end of next week."`;

export function AddBookSheet({ visible, onClose }: AddBookSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addBook } = useLibrary();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setTitle("");
    setAuthor("");
    setContent("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "text/plain" });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = await fetch(asset.uri).then((r) => r.text());
      setContent(text);
      if (!title && asset.name) {
        setTitle(asset.name.replace(/\.txt$/i, ""));
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {
      setError("Не удалось загрузить файл.");
    }
  };

  const loadSample = () => {
    setTitle("Pride and Prejudice");
    setAuthor("Jane Austen");
    setContent(SAMPLE_TEXT);
    Haptics.selectionAsync();
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Введите название книги."); return; }
    if (!content.trim()) { setError("Добавьте текст книги."); return; }
    setError("");
    setLoading(true);
    try {
      await addBook(title.trim(), author.trim(), "en", content.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
    } catch (_) {
      setError("Ошибка сохранения. Попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Добавить книгу</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>НАЗВАНИЕ *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={title}
                onChangeText={setTitle}
                placeholder="Введите название"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>АВТОР</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={author}
                onChangeText={setAuthor}
                placeholder="Введите автора"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>ТЕКСТ *</Text>
              <View style={styles.contentActions}>
                <Pressable
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={pickFile}
                >
                  <Feather name="upload" size={14} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>TXT файл</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                  onPress={loadSample}
                >
                  <Feather name="book-open" size={14} color={colors.primary} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>Пример</Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                value={content}
                onChangeText={setContent}
                placeholder="Вставьте текст книги..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                numberOfLines={8}
              />
              {content.length > 0 && (
                <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
                  {content.length.toLocaleString()} символов
                </Text>
              )}
            </View>

            {error ? <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}

            <Pressable
              style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <Text style={[styles.submitText, { color: colors.primaryForeground }]}>Добавить в библиотеку</Text>
              )}
            </Pressable>
          </View>
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
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  form: { padding: 20, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  contentActions: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 160,
  },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "right" },
  error: { fontSize: 13, fontFamily: "Inter_400Regular" },
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
