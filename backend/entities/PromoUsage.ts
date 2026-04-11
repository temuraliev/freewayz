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

  @Column()
  promoCodeId!: number;

  @ManyToOne("PromoCode", "usedBy")
  @JoinColumn({ name: "promoCodeId" })
  promoCode!: PromoCode;

  @Column()
  userId!: number;

  @ManyToOne("User", "promoUsages")
  @JoinColumn({ name: "userId" })
  user!: User;

  @CreateDateColumn()
  usedAt!: Date;
}
