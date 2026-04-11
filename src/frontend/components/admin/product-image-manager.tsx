"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";

interface Props {
  imageRefs: string[];
  imageUrls: string[];
  loading: boolean;
  uploading: boolean;
  onMove: (index: number, direction: "up" | "down") => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  onUpload: (file: File) => void;
}

export function ProductImageManager({
  imageRefs,
  imageUrls,
  loading,
  uploading,
  onMove,
  onReorder,
  onRemove,
  onUpload,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0 && e.pointerType !== "touch") return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragIndex(index);
    setDropTargetIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const item = el?.closest("[data-photo-index]");
    if (item) {
      const idx = parseInt(item.getAttribute("data-photo-index") ?? "-1", 10);
      if (idx >= 0 && idx < imageRefs.length) setDropTargetIndex(idx);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragIndex === null) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (dropTargetIndex !== null && dropTargetIndex !== dragIndex) {
      onReorder(dragIndex, dropTargetIndex);
    }
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handlePointerLeave = () => {
    if (dragIndex !== null) setDropTargetIndex(dragIndex);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onUpload(file);
  };

  if (loading) {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Фото (зажмите и перетащите для смены порядка)
        </label>
        <div className="flex gap-2 flex-wrap">
          <div className="w-20 h-20 bg-secondary animate-pulse rounded" />
          <div className="w-20 h-20 bg-secondary animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-2 block">
        Фото (зажмите и перетащите для смены порядка)
      </label>
      <div className="flex flex-wrap gap-2">
        {imageUrls.map((url, i) => (
          <div
            key={imageRefs[i] ?? i}
            data-photo-index={i}
            className="relative group"
            style={{ touchAction: dragIndex === i ? "none" : "auto" }}
            onPointerDown={(e) => handlePointerDown(e, i)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerLeave}
          >
            <div
              className={`w-20 h-20 relative rounded border overflow-hidden bg-secondary transition-all ${
                dragIndex === i
                  ? "opacity-60 scale-95 z-10 border-primary ring-2 ring-primary"
                  : dropTargetIndex === i && dragIndex !== null
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "border-border"
              }`}
            >
              <Image
                src={url}
                alt=""
                fill
                className="object-cover pointer-events-none select-none"
                sizes="80px"
                unoptimized
                draggable={false}
              />
            </div>
            <span className="absolute left-1 bottom-1 text-[10px] font-mono bg-black/70 text-white px-1 rounded">
              {i + 1}
            </span>
            <div
              className="absolute right-1 top-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(i, "up");
                }}
                disabled={i === 0}
                className="p-1 bg-background/90 text-foreground rounded disabled:opacity-30"
                aria-label="Вверх"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(i, "down");
                }}
                disabled={i === imageUrls.length - 1}
                className="p-1 bg-background/90 text-foreground rounded disabled:opacity-30"
                aria-label="Вниз"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                className="p-1 bg-red-600/90 text-white rounded"
                aria-label="Удалить"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
        <label className="w-20 h-20 flex flex-col items-center justify-center border border-dashed border-border rounded cursor-pointer hover:bg-muted/50 transition bg-secondary/30">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          {uploading ? (
            <span className="text-[10px] text-muted-foreground">Загрузка…</span>
          ) : (
            <>
              <Plus className="h-6 w-6 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground mt-1">Добавить</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}
