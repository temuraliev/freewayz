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

@Entity("user_roles")
@Unique(["userId", "role"])
export class UserRole {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "int" })
  userId!: number;

  @ManyToOne("users", "roles", { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: User;

  @Index()
  @Column({ type: "varchar", length: 50 })
  role!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
