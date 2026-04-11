import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1713400000000 implements MigrationInterface {
  name = "InitialSchema1713400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Catalog tables ──────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE brands (
        id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        logoUrl VARCHAR(500) NULL,
        isFeatured TINYINT NOT NULL DEFAULT 0,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_brands_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE categories (
        id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        imageUrl VARCHAR(500) NULL,
        subtypes TEXT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_categories_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE styles (
        id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(100) NOT NULL,
        isFeatured TINYINT NOT NULL DEFAULT 1,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_styles_slug (slug)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE products (
        id INT NOT NULL AUTO_INCREMENT,
        title VARCHAR(300) NOT NULL,
        slug VARCHAR(200) NOT NULL,
        description TEXT NULL,
        price DECIMAL(12,2) NOT NULL,
        originalPrice DECIMAL(12,2) NULL,
        subtype VARCHAR(100) NULL,
        sizes TEXT NOT NULL,
        colors TEXT NOT NULL,
        isHotDrop TINYINT NOT NULL DEFAULT 0,
        isOnSale TINYINT NOT NULL DEFAULT 0,
        isNewArrival TINYINT NOT NULL DEFAULT 0,
        isEssential TINYINT NOT NULL DEFAULT 0,
        internalNotes TEXT NULL,
        keywords TEXT NULL,
        sourceUrl VARCHAR(500) NULL,
        model3dUrl VARCHAR(500) NULL,
        model3dR2Key VARCHAR(300) NULL,
        brandId INT NULL,
        categoryId INT NULL,
        styleId INT NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_products_slug (slug),
        INDEX IDX_products_brandId (brandId),
        INDEX IDX_products_categoryId (categoryId),
        INDEX IDX_products_styleId (styleId),
        INDEX IDX_products_isHotDrop (isHotDrop),
        INDEX IDX_products_isOnSale (isOnSale),
        INDEX IDX_products_isNewArrival (isNewArrival),
        INDEX IDX_products_isEssential (isEssential),
        FULLTEXT INDEX ft_product_search (title, description, subtype),
        CONSTRAINT FK_products_brand FOREIGN KEY (brandId) REFERENCES brands(id) ON DELETE SET NULL,
        CONSTRAINT FK_products_category FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL,
        CONSTRAINT FK_products_style FOREIGN KEY (styleId) REFERENCES styles(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE product_images (
        id INT NOT NULL AUTO_INCREMENT,
        productId INT NOT NULL,
        url VARCHAR(500) NOT NULL,
        r2Key VARCHAR(300) NOT NULL,
        sortOrder INT NOT NULL DEFAULT 0,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_product_images_product_sort (productId, sortOrder),
        CONSTRAINT FK_product_images_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE product_videos (
        id INT NOT NULL AUTO_INCREMENT,
        productId INT NOT NULL,
        url VARCHAR(500) NOT NULL,
        r2Key VARCHAR(300) NOT NULL,
        sortOrder INT NOT NULL DEFAULT 0,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_product_videos_productId (productId),
        CONSTRAINT FK_product_videos_product FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── User tables ─────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE users (
        id INT NOT NULL AUTO_INCREMENT,
        telegramId VARCHAR(100) NOT NULL,
        username VARCHAR(200) NULL,
        firstName VARCHAR(200) NULL,
        lastName VARCHAR(200) NULL,
        photoUrl VARCHAR(500) NULL,
        phone VARCHAR(100) NULL,
        address TEXT NULL,
        adminNotes TEXT NULL,
        totalSpent FLOAT NOT NULL DEFAULT 0,
        status ENUM('ROOKIE','PRO','LEGEND') NOT NULL DEFAULT 'ROOKIE',
        cashbackBalance FLOAT NOT NULL DEFAULT 0,
        onboardingDone TINYINT NOT NULL DEFAULT 0,
        referredBy VARCHAR(100) NULL,
        preferredBrandIds TEXT NULL,
        preferredStyleIds TEXT NULL,
        cartItems TEXT NULL,
        cartUpdatedAt DATETIME NULL,
        abandonedCartNotified TINYINT NOT NULL DEFAULT 0,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_users_telegramId (telegramId),
        INDEX IDX_users_username (username),
        INDEX IDX_users_status (status),
        INDEX IDX_users_referredBy (referredBy),
        INDEX IDX_users_abandoned (abandonedCartNotified, cartUpdatedAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE cart_items (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        productId VARCHAR(200) NOT NULL,
        title VARCHAR(300) NULL,
        brand VARCHAR(200) NULL,
        size VARCHAR(50) NOT NULL,
        color VARCHAR(100) NULL,
        price FLOAT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        imageUrl VARCHAR(500) NULL,
        addedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_cart_items_unique (userId, productId, size, color),
        INDEX IDX_cart_items_userId (userId),
        CONSTRAINT FK_cart_items_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE user_preferences (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        preferenceType ENUM('brand','style') NOT NULL,
        externalId VARCHAR(200) NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_user_preferences_unique (userId, preferenceType, externalId),
        INDEX IDX_user_preferences_userId (userId),
        CONSTRAINT FK_user_preferences_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE product_views (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        productId VARCHAR(200) NOT NULL,
        brandSlug VARCHAR(100) NULL,
        styleSlug VARCHAR(100) NULL,
        viewedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_product_views_user_date (userId, viewedAt),
        INDEX IDX_product_views_productId (productId),
        CONSTRAINT FK_product_views_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE wishlist_items (
        id INT NOT NULL AUTO_INCREMENT,
        userId INT NOT NULL,
        productId VARCHAR(200) NOT NULL,
        title VARCHAR(300) NULL,
        brand VARCHAR(200) NULL,
        price FLOAT NULL,
        imageUrl VARCHAR(500) NULL,
        addedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_wishlist_items_unique (userId, productId),
        INDEX IDX_wishlist_items_userId (userId),
        CONSTRAINT FK_wishlist_items_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── Commerce tables ─────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE orders (
        id INT NOT NULL AUTO_INCREMENT,
        orderId VARCHAR(100) NOT NULL,
        userId INT NOT NULL,
        items JSON NOT NULL,
        total FLOAT NOT NULL,
        cost FLOAT NULL,
        status ENUM('new','paid','ordered','shipped','delivered','cancelled') NOT NULL DEFAULT 'new',
        trackNumber VARCHAR(200) NULL,
        trackUrl VARCHAR(500) NULL,
        carrier VARCHAR(100) NULL,
        track17Registered TINYINT NOT NULL DEFAULT 0,
        trackingStatus VARCHAR(200) NULL,
        trackingEvents JSON NULL,
        shippingMethod VARCHAR(100) NULL,
        promoCode VARCHAR(100) NULL,
        discount FLOAT NULL,
        notes TEXT NULL,
        idempotencyKey VARCHAR(200) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_orders_orderId (orderId),
        UNIQUE INDEX IDX_orders_idempotencyKey (idempotencyKey),
        INDEX IDX_orders_status (status),
        INDEX IDX_orders_userId (userId),
        INDEX IDX_orders_createdAt (createdAt),
        INDEX IDX_orders_trackNumber (trackNumber),
        CONSTRAINT FK_orders_user FOREIGN KEY (userId) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE expenses (
        id INT NOT NULL AUTO_INCREMENT,
        date DATETIME NOT NULL,
        amount FLOAT NOT NULL,
        currency ENUM('UZS','CNY','USD') NOT NULL DEFAULT 'UZS',
        category ENUM('shipping','purchase','packaging','other') NOT NULL DEFAULT 'other',
        description TEXT NULL,
        orderId INT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        INDEX IDX_expenses_date (date),
        INDEX IDX_expenses_orderId (orderId),
        CONSTRAINT FK_expenses_order FOREIGN KEY (orderId) REFERENCES orders(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE promo_codes (
        id INT NOT NULL AUTO_INCREMENT,
        code VARCHAR(100) NOT NULL,
        type ENUM('discount_percent','discount_fixed','balance_topup') NOT NULL,
        value FLOAT NOT NULL,
        minOrderTotal FLOAT NULL,
        maxUses INT NULL,
        usedCount INT NOT NULL DEFAULT 0,
        maxUsesPerUser INT NOT NULL DEFAULT 1,
        isActive TINYINT NOT NULL DEFAULT 1,
        expiresAt DATETIME NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_promo_codes_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE promo_usages (
        id INT NOT NULL AUTO_INCREMENT,
        promoCodeId INT NOT NULL,
        userId INT NOT NULL,
        usedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        UNIQUE INDEX IDX_promo_usages_unique (promoCodeId, userId),
        CONSTRAINT FK_promo_usages_promo FOREIGN KEY (promoCodeId) REFERENCES promo_codes(id),
        CONSTRAINT FK_promo_usages_user FOREIGN KEY (userId) REFERENCES users(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── Operations tables ───────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE suppliers (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(300) NOT NULL,
        url VARCHAR(500) NOT NULL,
        lastCheckedAt DATETIME NULL,
        lastAlbumCount INT NULL,
        knownAlbumIds TEXT NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS promo_usages`);
    await queryRunner.query(`DROP TABLE IF EXISTS promo_codes`);
    await queryRunner.query(`DROP TABLE IF EXISTS expenses`);
    await queryRunner.query(`DROP TABLE IF EXISTS orders`);
    await queryRunner.query(`DROP TABLE IF EXISTS wishlist_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_views`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_preferences`);
    await queryRunner.query(`DROP TABLE IF EXISTS cart_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_videos`);
    await queryRunner.query(`DROP TABLE IF EXISTS product_images`);
    await queryRunner.query(`DROP TABLE IF EXISTS products`);
    await queryRunner.query(`DROP TABLE IF EXISTS styles`);
    await queryRunner.query(`DROP TABLE IF EXISTS categories`);
    await queryRunner.query(`DROP TABLE IF EXISTS brands`);
    await queryRunner.query(`DROP TABLE IF EXISTS suppliers`);
  }
}
