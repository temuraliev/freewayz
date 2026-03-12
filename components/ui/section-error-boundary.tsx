"use client";

import React from "react";

interface SectionErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error boundary that catches rendering errors in product sections.
 * Prevents one broken section from crashing the entire page.
 */
export class SectionErrorBoundary extends React.Component<SectionErrorBoundaryProps, State> {
  constructor(props: SectionErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[SectionErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center py-12 px-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">
              Не удалось загрузить секцию
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
