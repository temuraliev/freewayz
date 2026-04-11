import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import type { User } from "./User";

@Entity("product_views")
@Index(["userId", "viewedAt"])
export class ProductViewEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: number;

  @ManyToOne("User", "productViews", { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Index()
  @Column({ type: "varchar", length: 200 })
  productId!: string;

  @Column({ type: "varchar", length: 100, nullable: true })
  brandSlug!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  styleSlug!: string | null;

  @CreateDateColumn()
  viewedAt!: Date;
}
