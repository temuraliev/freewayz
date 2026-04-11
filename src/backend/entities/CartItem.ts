import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  Unique,
  JoinColumn,
} from "typeorm";
import type { User } from "./User";

@Entity("cart_items")
@Unique(["userId", "productId", "size", "color"])
export class CartItemEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  userId!: number;

  @ManyToOne("User", "cartItemsRel", { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "varchar", length: 200 })
  productId!: string;

  @Column({ type: "varchar", length: 300, nullable: true })
  title!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  brand!: string | null;

  @Column({ type: "varchar", length: 50 })
  size!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  color!: string | null;

  @Column({ type: "float" })
  price!: number;

  @Column({ type: "int", default: 1 })
  quantity!: number;

  @Column({ type: "varchar", length: 500, nullable: true })
  imageUrl!: string | null;

  @CreateDateColumn()
  addedAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
