import { ImageResponse } from "next/og";
import { client } from "@/lib/sanity/client";
import { productBySlugQuery } from "@/lib/sanity/queries";
import { Product } from "@/lib/types";

export const runtime = "edge";
export const alt = "FreeWayz";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatUZS(price: number): string {
  return new Intl.NumberFormat("ru-RU").format(price) + " UZS";
}

export default async function OgImage({ params }: { params: { slug: string } }) {
  let product: Product | null = null;
  try {
    product = await client.fetch<Product | null>(productBySlugQuery, { slug: params.slug });
  } catch {
    // fallthrough to default image
  }

  if (!product) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0a0a0a",
            color: "#fff",
            fontSize: 80,
            fontFamily: "sans-serif",
          }}
        >
          FREEWAYZ
        </div>
      ),
      { ...size }
    );
  }

  const brandName =
    typeof product.brand === "string" ? product.brand : product.brand?.title || "";
  const firstImage =
    Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null;
  const price = formatUZS(product.price || 0);
  const originalPrice =
    product.originalPrice && product.originalPrice > product.price
      ? formatUZS(product.originalPrice)
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0a0a0a",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: product image */}
        {firstImage ? (
          <div
            style={{
              width: 630,
              height: 630,
              display: "flex",
              backgroundColor: "#1a1a1a",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firstImage}
              alt={product.title}
              width={630}
              height={630}
              style={{ objectFit: "cover" }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 630,
              height: 630,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#1a1a1a",
              color: "#666",
              fontSize: 40,
            }}
          >
            No Image
          </div>
        )}

        {/* Right: info */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 50px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#888",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: 20,
              }}
            >
              FREEWAYZ
            </div>

            {brandName && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#fff",
                  textTransform: "uppercase",
                  marginBottom: 12,
                }}
              >
                {brandName}
              </div>
            )}

            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                lineHeight: 1.1,
                color: "#fff",
                maxWidth: 480,
                display: "flex",
              }}
            >
              {product.title.length > 40
                ? product.title.slice(0, 40) + "…"
                : product.title}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {originalPrice && (
              <div
                style={{
                  fontSize: 24,
                  color: "#666",
                  textDecoration: "line-through",
                }}
              >
                {originalPrice}
              </div>
            )}
            <div
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: product.isOnSale ? "#ef4444" : "#fff",
              }}
            >
              {price}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
