"use client";

import { useEffect, useState, useRef } from "react";
import { ru } from "@/lib/i18n/ru";

const MODEL_VIEWER_SCRIPT = "https://unpkg.com/@google/model-viewer@3.5.0/dist/model-viewer.min.js";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "camera-controls"?: boolean;
          "auto-rotate"?: boolean;
          poster?: string;
        },
        HTMLElement
      >;
    }
  }
}

interface ModelViewer3dProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ModelViewer3d({ src, alt, className }: ModelViewer3dProps) {
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !src) return;

    const isDefined = customElements.get("model-viewer");
    if (isDefined) {
      setReady(true);
      return;
    }

    const existing = document.querySelector(`script[src="${MODEL_VIEWER_SCRIPT}"]`);
    if (existing) {
      customElements.whenDefined("model-viewer").then(() => setReady(true));
      return;
    }

    const script = document.createElement("script");
    script.src = MODEL_VIEWER_SCRIPT;
    script.type = "module";
    script.onload = () => {
      customElements.whenDefined("model-viewer").then(() => setReady(true));
    };
    document.head.appendChild(script);
  }, [src]);

  if (!ready) {
    return (
      <div
        className={`flex aspect-square items-center justify-center rounded-xl border border-border bg-secondary/50 ${className ?? ""}`}
      >
        <p className="text-sm text-muted-foreground">{ru.view3DLoading}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={className}>
      {/* @ts-expect-error custom element */}
      <model-viewer
        src={src}
        alt={alt ?? ""}
        camera-controls
        auto-rotate
        className="h-full min-h-[280px] w-full rounded-xl border border-border bg-secondary/30"
        style={{ width: "100%", minHeight: "280px" }}
      />
    </div>
  );
}
