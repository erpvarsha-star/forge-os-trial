import { useState, useCallback } from "react";

interface ChecklistItem { id: string; label: string; checked: boolean; }

export function useChecklist(initialItems: ChecklistItem[]) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems);
  const toggleItem = useCallback((id: string) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, checked: !item.checked } : item));
  }, []);
  const allChecked = items.every((item) => item.checked);
  const checkedCount = items.filter((item) => item.checked).length;
  return { items, toggleItem, allChecked, checkedCount };
}