import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
  JoinColumn,
} from "typeorm";
import type { PromoCode } from "./PromoCode";
import type { User } from "./User";

@Entity("promo_usages")
@Unique(["promoCodeId", "userId"])
export class PromoUsage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "int" })
  promoCodeId!: number;

  @ManyToOne("promo_codes", "usedBy")
  @JoinColumn({ name: "promoCodeId" })
  promoCode!: PromoCode;

  @Column({ type: "int" })
  userId!: number;

  @ManyToOne("users", "promoUsages")
  @JoinColumn({ name: "userId" })
  user!: User;

  @CreateDateColumn()
  usedAt!: Date;
}
