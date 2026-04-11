import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from "typeorm";
import type { Product } from "./Product";

@Entity("styles")
export class Style {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 200 })
  title!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 100 })
  slug!: string;

  @Index()
  @Column({ type: "boolean", default: true })
  isFeatured!: boolean;

  @OneToMany("Product", "style")
  products!: Product[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
