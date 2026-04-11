import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { PromoUsage } from "./PromoUsage";

export enum PromoType {
  DISCOUNT_PERCENT = "discount_percent",
  DISCOUNT_FIXED = "discount_fixed",
  BALANCE_TOPUP = "balance_topup",
}

@Entity("promo_codes")
export class PromoCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  code!: string;

  @Column({ type: "enum", enum: PromoType })
  type!: PromoType;

  @Column({ type: "float" })
  value!: number;

  @Column({ type: "float", nullable: true })
  minOrderTotal!: number | null;

  @Column({ type: "int", nullable: true })
  maxUses!: number | null;

  @Column({ type: "int", default: 0 })
  usedCount!: number;

  @Column({ type: "int", default: 1 })
  maxUsesPerUser!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "datetime", nullable: true })
  expiresAt!: Date | null;

  @OneToMany(() => PromoUsage, (usage) => usage.promoCode)
  usedBy!: PromoUsage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
