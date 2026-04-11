import { prisma } from "./db.js";

export interface CartItemInput {
  productId: string;
  title?: string;
  brand?: string;
  size: string;
  color?: string | null;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export async function getCart(userId: number) {
  return prisma.cartItem.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });
}

export async function syncCart(userId: number, items: CartItemInput[]) {
  await prisma.$transaction([
    prisma.cartItem.deleteMany({ where: { userId } }),
    ...items.map((item) =>
      prisma.cartItem.create({
        data: {
          userId,
          productId: item.productId,
          title: item.title ?? null,
          brand: item.brand ?? null,
          size: item.size,
          color: item.color ?? null,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl ?? null,
        },
      })
    ),
    prisma.user.update({
      where: { id: userId },
      data: {
        cartUpdatedAt: items.length > 0 ? new Date() : null,
        abandonedCartNotified: false,
      },
    }),
  ]);
}

export async function clearCart(userId: number) {
  await prisma.cartItem.deleteMany({ where: { userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { cartUpdatedAt: null, abandonedCartNotified: false },
  });
}
