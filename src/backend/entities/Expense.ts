import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  JoinColumn,
} from "typeorm";
import type { OrderEntity } from "./Order";

export enum ExpenseCurrency {
  UZS = "UZS",
  CNY = "CNY",
  USD = "USD",
}

export enum ExpenseCategory {
  SHIPPING = "shipping",
  PURCHASE = "purchase",
  PACKAGING = "packaging",
  OTHER = "other",
}

@Entity("expenses")
export class Expense {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "datetime" })
  date!: Date;

  @Column({ type: "float" })
  amount!: number;

  @Column({ type: "enum", enum: ExpenseCurrency, default: ExpenseCurrency.UZS })
  currency!: ExpenseCurrency;

  @Column({ type: "enum", enum: ExpenseCategory, default: ExpenseCategory.OTHER })
  category!: ExpenseCategory;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Index()
  @Column({ type: "int", nullable: true })
  orderId!: number | null;

  @ManyToOne("orders", "expenses", { nullable: true })
  @JoinColumn({ name: "orderId" })
  order!: OrderEntity | null;

  @CreateDateColumn()
  createdAt!: Date;
}
