import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("suppliers")
export class Supplier {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 300 })
  name!: string;

  @Column({ type: "varchar", length: 500 })
  url!: string;

  @Column({ type: "datetime", nullable: true })
  lastCheckedAt!: Date | null;

  @Column({ type: "int", nullable: true })
  lastAlbumCount!: number | null;

  @Column({ type: "simple-json", nullable: true })
  knownAlbumIds!: string[] | null;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
