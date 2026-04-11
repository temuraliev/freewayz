"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import useSWR from "swr";
import { useCartStore } from "@frontend/stores";
import { formatPrice } from "@shared/utils";
import { Product } from "@shared/types";
import { useState } from "react";

interface EssentialProduct {
  _id: string;
  title: string;
  slug: { current: string };
  price: number;
  images?: string[];
  brand?: { _id: string; title: string; slug: { current: string } };
  subtype?: string;
}

async function fetchEssentials(): Promise<EssentialProduct[]> {
  const res = await fetch("/api/products/essentials");
  return res.json();
}

export function EssentialsUpsell() {
  const { data: essentials, isLoading } = useSWR("essentials", fetchEssentials, {
    revalidateOnFocus: false,
  });
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);

  // Filter out items already in cart
  const cartProductIds = new Set(cartItems.map((i) => i.product._id));
  const available = (essentials ?? []).filter((e) => !cartProductIds.has(e._id));

  if (isLoading || available.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Дополни заказ
        </h3>
      </div>
      <p className="text-[11px] text-muted-foreground/70 mb-3">
        Вешалки, коробки для кроссовок, роллеры и другие полезные аксессуары
      </p>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {available.map((item) => (
          <EssentialCard
            key={item._id}
            item={item}
            onAdd={() => {
              addItem(
                {
                  _id: item._id,
                  title: item.title,
                  slug: item.slug,
                  price: item.price,
                  images: item.images ?? [],
                  brand: item.brand ?? null,
                  style: null,
                  category: null,
                  sizes: ["One Size"],
                  colors: [],
                } as Product,
                "One Size",
                null
              );
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

function EssentialCard({
  item,
  onAdd,
}: {
  item: EssentialProduct;
  onAdd: () => void;
}) {
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    onAdd();
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="w-32 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
      <Link href={`/product/${item.slug.current}`}>
        <div className="relative aspect-square bg-secondary">
          {item.images?.[0] ? (
            <Image
              src={item.images[0]}
              alt={item.title}
              fill
              className="object-cover"
              sizes="128px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Нет фото
            </div>
          )}
        </div>
      </Link>
      <div className="p-2">
        <p className="line-clamp-2 text-[11px] leading-tight">{item.title}</p>
        <p className="mt-1 text-xs font-mono font-semibold">
          {formatPrice(item.price)}
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleAdd}
          disabled={added}
          className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded border py-1.5 text-[10px] font-medium transition-colors ${
            added
              ? "border-green-500/40 bg-green-500/10 text-green-400"
              : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          {added ? (
            "Добавлено ✓"
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Добавить
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
