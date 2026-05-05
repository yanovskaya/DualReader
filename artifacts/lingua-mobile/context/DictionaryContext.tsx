import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface DictionaryEntry {
  word: string;
  translations: string[];
  synonyms: string[];
  partOfSpeech: string | null;
  transcription: string | null;
  examples: string[];
  exampleTranslations: string[];
  lookedUpAt: string;
}

interface DictionaryContextType {
  entries: DictionaryEntry[];
  lookup: (word: string) => DictionaryEntry | undefined;
  saveEntry: (entry: DictionaryEntry) => Promise<void>;
  recent: DictionaryEntry[];
}

const DictionaryContext = createContext<DictionaryContextType | null>(null);
const DICT_KEY = "@lingua/dictionary";

export function DictionaryProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(DICT_KEY).then((json) => {
      if (json) setEntries(JSON.parse(json));
    });
  }, []);

  const saveEntry = useCallback(async (entry: DictionaryEntry) => {
    setEntries((prev) => {
      const filtered = prev.filter((e) => e.word.toLowerCase() !== entry.word.toLowerCase());
      const updated = [entry, ...filtered];
      AsyncStorage.setItem(DICT_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const lookup = useCallback(
    (word: string) =>
      entries.find((e) => e.word.toLowerCase() === word.toLowerCase().trim()),
    [entries]
  );

  const recent = entries.slice(0, 20);

  return (
    <DictionaryContext.Provider value={{ entries, lookup, saveEntry, recent }}>
      {children}
    </DictionaryContext.Provider>
  );
}

export function useDictionary() {
  const ctx = useContext(DictionaryContext);
  if (!ctx) throw new Error("useDictionary must be used within DictionaryProvider");
  return ctx;
}
