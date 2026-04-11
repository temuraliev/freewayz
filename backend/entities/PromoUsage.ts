import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
  JoinColumn,
} from "typeorm";
import { PromoCode } from "./PromoCode";
import { User } from "./User";

@Entity("promo_usages")
@Unique(["promoCodeId", "userId"])
export class PromoUsage {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  promoCodeId!: number;

  @ManyToOne(() => PromoCode, (promo) => promo.usedBy)
  @JoinColumn({ name: "promoCodeId" })
  promoCode!: PromoCode;

  @Column()
  userId!: number;

  @ManyToOne(() => User, (user) => user.promoUsages)
  @JoinColumn({ name: "userId" })
  user!: User;

  @CreateDateColumn()
  usedAt!: Date;
}
