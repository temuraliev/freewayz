import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  Unique,
  JoinColumn,
} from "typeorm";
import { User } from "./User";

@Entity("wishlist_items")
@Unique(["userId", "productId"])
export class WishlistItemEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  userId!: number;

  @ManyToOne(() => User, (user) => user.wishlistItems, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "varchar", length: 200 })
  productId!: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  title!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  brand!: string | null;

  @Column({ type: "float", nullable: true })
  price!: number | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl!: string | null;

  @CreateDateColumn()
  addedAt!: Date;
}
