"use client";

import useSWR from "swr";
import Link from "next/link";
import Image from "next/image";
import { fetcher } from "@frontend/lib/swr-fetcher";
import { formatPrice } from "@shared/utils";
import { ru } from "@shared/i18n/ru";

interface ViewedProduct {
  _id: string;
  title: string;
  slug: { current: string };
  price: number;
  originalPrice?: number;
  images: string[];
  brand?: { title: string; slug: { current: string } };
  isOnSale?: boolean;
}

interface Response {
  products: ViewedProduct[];
}

interface Props {
  excludeId?: string;
  title?: string;
}

export function RecentlyViewed({ excludeId, title }: Props) {
  const { data, isLoading } = useSWR<Response>(
    "/api/user/recently-viewed",
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) return null;

  const products = (data?.products ?? []).filter((p) => p._id !== excludeId);
  if (products.length === 0) return null;

  return (
    <div className="mt-6 border-t border-border pt-6">
      <h3 className="px-4 mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title ?? ru.recentlyViewed ?? "Недавно смотрели"}
      </h3>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {products.map((p) => (
          <Link
            key={p._id}
            href={`/product/${p.slug.current}`}
            className="w-28 shrink-0 overflow-hidden rounded-lg border border-border bg-card transition hover:border-foreground/40"
          >
            <div className="relative aspect-square bg-secondary">
              {p.images?.[0] ? (
                <Image
                  src={p.images[0]}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="112px"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
                  No img
                </div>
              )}
            </div>
            <div className="p-2">
              <p className="line-clamp-1 text-[11px] font-medium">{p.title}</p>
              <p className="mt-0.5 text-[11px] font-mono font-bold">
                {formatPrice(p.price)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
