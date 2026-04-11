import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRoles1713400001000 implements MigrationInterface {
  name = "AddUserRoles1713400001000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE user_roles (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        role VARCHAR(50) NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_user_roles_unique (userId, role),
        INDEX IDX_user_roles_userId (userId),
        INDEX IDX_user_roles_role (role),
        CONSTRAINT FK_user_roles_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_roles`);
  }
}
