import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import type { CartItemEntity } from "./CartItem";
import type { UserPreference } from "./UserPreference";
import type { ProductViewEntity } from "./ProductView";
import type { WishlistItemEntity } from "./WishlistItem";
import type { OrderEntity } from "./Order";
import type { PromoUsage } from "./PromoUsage";
import type { UserRole } from "./UserRole";

export enum UserStatus {
  ROOKIE = "ROOKIE",
  PRO = "PRO",
  LEGEND = "LEGEND",
}

@Entity("users")
@Index(["abandonedCartNotified", "cartUpdatedAt"])
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  telegramId!: string;

  @Index()
  @Column({ type: "varchar", length: 200, nullable: true })
  username!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  firstName!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  lastName!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  photoUrl!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  phone!: string | null;

  @Column({ type: "text", nullable: true })
  address!: string | null;

  @Column({ type: "text", nullable: true })
  adminNotes!: string | null;

  @Column({ type: "float", default: 0 })
  totalSpent!: number;

  @Index()
  @Column({ type: "enum", enum: UserStatus, default: UserStatus.ROOKIE })
  status!: UserStatus;

  @Column({ type: "float", default: 0 })
  cashbackBalance!: number;

  @Column({ type: "boolean", default: false })
  onboardingDone!: boolean;

  @Index()
  @Column({ type: "varchar", length: 100, nullable: true })
  referredBy!: string | null;

  // DEPRECATED: use userPreferences relation
  @Column({ type: "simple-json", nullable: true })
  preferredBrandIds!: string[] | null;

  // DEPRECATED: use userPreferences relation
  @Column({ type: "simple-json", nullable: true })
  preferredStyleIds!: string[] | null;

  // DEPRECATED: use cartItemsRel relation
  @Column({ type: "text", nullable: true })
  cartItems!: string | null;

  @Column({ type: "datetime", nullable: true })
  cartUpdatedAt!: Date | null;

  @Column({ type: "boolean", default: false })
  abandonedCartNotified!: boolean;

  @OneToMany("OrderEntity", "user")
  orders!: OrderEntity[];

  @OneToMany("PromoUsage", "user")
  promoUsages!: PromoUsage[];

  @OneToMany("CartItemEntity", "user")
  cartItemsRel!: CartItemEntity[];

  @OneToMany("UserPreference", "user")
  userPreferences!: UserPreference[];

  @OneToMany("ProductViewEntity", "user")
  productViews!: ProductViewEntity[];

  @OneToMany("WishlistItemEntity", "user")
  wishlistItems!: WishlistItemEntity[];

  @OneToMany("UserRole", "user")
  roles!: UserRole[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
