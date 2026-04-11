import { getDataSource } from "@backend/data-source";
import { CartItemEntity } from "@backend/entities/CartItem";
import { User } from "@backend/entities/User";

/**
 * Cart service using the normalized CartItem model.
 * Replaces legacy JSON-string cartItems field on User.
 *
 * Migration status: new code should use these functions. The legacy
 * User.cartItems field is kept for backward compatibility during rollout.
 */

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
  const ds = await getDataSource();
  const cartRepo = ds.getRepository(CartItemEntity);
  return cartRepo.find({
    where: { userId },
    order: { addedAt: "DESC" },
  });
}

export async function syncCart(userId: number, items: CartItemInput[]) {
  const ds = await getDataSource();

  // Replace entire cart in a single transaction
  await ds.transaction(async (manager) => {
    const cartRepo = manager.getRepository(CartItemEntity);
    const userRepo = manager.getRepository(User);

    await cartRepo.delete({ userId });

    for (const item of items) {
      const entity = cartRepo.create({
        userId,
        productId: item.productId,
        title: item.title ?? null,
        brand: item.brand ?? null,
        size: item.size,
        color: item.color ?? null,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl ?? null,
      });
      await cartRepo.save(entity);
    }

    await userRepo.update(userId, {
      cartUpdatedAt: items.length > 0 ? new Date() : null,
      abandonedCartNotified: false,
    });
  });
}

export async function clearCart(userId: number) {
  const ds = await getDataSource();
  const cartRepo = ds.getRepository(CartItemEntity);
  const userRepo = ds.getRepository(User);

  await cartRepo.delete({ userId });
  await userRepo.update(userId, {
    cartUpdatedAt: null,
    abandonedCartNotified: false,
  });
}
