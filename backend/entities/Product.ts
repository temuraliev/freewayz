import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { Brand } from "./Brand";
import { Category } from "./Category";
import { Style } from "./Style";
import { ProductImage } from "./ProductImage";
import { ProductVideo } from "./ProductVideo";

@Entity("products")
@Index("ft_product_search", ["title", "description", "subtype"], { fulltext: true })
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 300 })
  title!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 200 })
  slug!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "decimal", precision: 12, scale: 2 })
  price!: number;

  @Column({ type: "decimal", precision: 12, scale: 2, nullable: true })
  originalPrice!: number | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  subtype!: string | null;

  @Column({ type: "simple-json" })
  sizes!: string[];

  @Column({ type: "simple-json" })
  colors!: string[];

  @Index()
  @Column({ type: "boolean", default: false })
  isHotDrop!: boolean;

  @Index()
  @Column({ type: "boolean", default: false })
  isOnSale!: boolean;

  @Index()
  @Column({ type: "boolean", default: false })
  isNewArrival!: boolean;

  @Index()
  @Column({ type: "boolean", default: false })
  isEssential!: boolean;

  @Column({ type: "text", nullable: true })
  internalNotes!: string | null;

  @Column({ type: "simple-json", nullable: true })
  keywords!: string[] | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  sourceUrl!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  model3dUrl!: string | null;

  @Column({ type: "varchar", length: 300, nullable: true })
  model3dR2Key!: string | null;

  // ── Relations ──

  @Index()
  @Column({ nullable: true })
  brandId!: number | null;

  @ManyToOne(() => Brand, (brand) => brand.products, { nullable: true })
  @JoinColumn({ name: "brandId" })
  brand!: Brand | null;

  @Index()
  @Column({ nullable: true })
  categoryId!: number | null;

  @ManyToOne(() => Category, (category) => category.products, { nullable: true })
  @JoinColumn({ name: "categoryId" })
  category!: Category | null;

  @Index()
  @Column()
  styleId!: number;

  @ManyToOne(() => Style, (style) => style.products)
  @JoinColumn({ name: "styleId" })
  style!: Style;

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
  images!: ProductImage[];

  @OneToMany(() => ProductVideo, (video) => video.product, { cascade: true })
  videos!: ProductVideo[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
