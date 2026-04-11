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
import { User } from "./User";
import { Expense } from "./Expense";

export enum OrderStatus {
  NEW = "new",
  PAID = "paid",
  ORDERED = "ordered",
  SHIPPED = "shipped",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
}

@Entity("orders")
export class OrderEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  orderId!: string;

  @Index()
  @Column()
  userId!: number;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "json" })
  items!: Record<string, unknown>[];

  @Column({ type: "float" })
  total!: number;

  @Column({ type: "float", nullable: true })
  cost!: number | null;

  @Index()
  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.NEW })
  status!: OrderStatus;

  @Index()
  @Column({ type: "varchar", length: 200, nullable: true })
  trackNumber!: string | null;

  @Column({ type: "varchar", length: 500, nullable: true })
  trackUrl!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  carrier!: string | null;

  @Column({ type: "boolean", default: false })
  track17Registered!: boolean;

  @Column({ type: "varchar", length: 200, nullable: true })
  trackingStatus!: string | null;

  @Column({ type: "json", nullable: true })
  trackingEvents!: Record<string, unknown>[] | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  shippingMethod!: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  promoCode!: string | null;

  @Column({ type: "float", nullable: true })
  discount!: number | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @Column({ type: "varchar", length: 200, nullable: true, unique: true })
  idempotencyKey!: string | null;

  @OneToMany(() => Expense, (expense) => expense.order)
  expenses!: Expense[];

  @Index()
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
