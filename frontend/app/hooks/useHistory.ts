"use client";

import { useState, useEffect, useCallback } from "react";

export interface HistoryEntry {
  jan: string;
  name: string | null;
  highestPrice: number | null;
  highestSite: string | null;
  time: string;
}

const STORAGE_KEY = "pricecheck_history";
const MAX_ENTRIES = 10;

function now(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${hh}:${mm} - ${dd}/${mo}`;
}

function load(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function save(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(load());
  }, []);

  const addEntry = useCallback(
    (entry: Omit<HistoryEntry, "time">) => {
      setHistory((prev) => {
        const next: HistoryEntry[] = [
          { ...entry, time: now() },
          ...prev.filter((e) => e.jan !== entry.jan),
        ].slice(0, MAX_ENTRIES);
        save(next);
        return next;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    save([]);
    setHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
