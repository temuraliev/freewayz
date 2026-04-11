import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import type { Product } from "./Product";

@Entity("product_videos")
@Index(["productId"])
export class ProductVideo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  productId!: number;

  @ManyToOne("Product", "videos", { onDelete: "CASCADE" })
  @JoinColumn({ name: "productId" })
  product!: Product;

  @Column({ type: "varchar", length: 500 })
  url!: string;

  @Column({ type: "varchar", length: 300 })
  r2Key!: string;

  @Column({ type: "int", default: 0 })
  sortOrder!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
