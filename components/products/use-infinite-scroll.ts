"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const PAGE_SIZE = 20;

interface UseInfiniteScrollOptions<T> {
  initialItems: T[];
  fetchPage: (offset: number) => Promise<T[]>;
}

export function useInfiniteScroll<T>({ initialItems, fetchPage }: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialItems.length >= PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(initialItems.length);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await fetchPage(offsetRef.current);
      if (!Array.isArray(newItems) || newItems.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...newItems]);
        offsetRef.current += newItems.length;
        if (newItems.length < PAGE_SIZE) setHasMore(false);
      }
    } catch {
      setHasMore(false);
    }
    setLoading(false);
  }, [loading, hasMore, fetchPage]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  // Reset when initial items change
  useEffect(() => {
    setItems(initialItems);
    offsetRef.current = initialItems.length;
    setHasMore(initialItems.length >= PAGE_SIZE);
  }, [initialItems]);

  return { items, loading, hasMore, sentinelRef };
}

export { PAGE_SIZE };
