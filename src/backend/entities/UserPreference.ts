import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
  Unique,
  JoinColumn,
} from "typeorm";
import type { User } from "./User";

export enum PreferenceType {
  BRAND = "brand",
  STYLE = "style",
}

@Entity("user_preferences")
@Unique(["userId", "preferenceType", "externalId"])
export class UserPreference {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column()
  userId!: number;

  @ManyToOne("User", "userPreferences", { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Column({ type: "enum", enum: PreferenceType })
  preferenceType!: PreferenceType;

  @Column({ type: "varchar", length: 200 })
  externalId!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
