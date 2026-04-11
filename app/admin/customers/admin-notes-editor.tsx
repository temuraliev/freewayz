"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { admin as adminApi } from "@/lib/api-client";

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export function AdminNotesEditor({
  customerId,
  initialNotes,
}: {
  customerId: number;
  initialNotes: string;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.patchCustomer(customerId, {
        initData: getInitData(),
        adminNotes: notes.trim(),
      });
      setSavedNotes(notes.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNotes(savedNotes);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        {savedNotes ? (
          <div className="flex-1 rounded bg-muted/50 p-2 text-xs">
            {savedNotes}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60 italic">Нет заметок</span>
        )}
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          title="Редактировать заметку"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full border border-border bg-background px-2 py-1.5 text-xs"
        placeholder="Заметки об этом клиенте..."
        autoFocus
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 bg-foreground px-2 py-1 text-[10px] font-medium text-background disabled:opacity-50"
        >
          <Check className="h-3 w-3" />
          {saving ? "…" : "Сохранить"}
        </button>
        <button
          onClick={handleCancel}
          className="flex items-center gap-1 border border-border px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Отмена
        </button>
      </div>
    </div>
  );
}
