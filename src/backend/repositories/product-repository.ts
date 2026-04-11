import { getDataSource } from "@backend/data-source";
import { Product } from "@backend/entities/Product";
import { Brand } from "@backend/entities/Brand";
import { Category } from "@backend/entities/Category";
import { Style } from "@backend/entities/Style";
import { Brackets, SelectQueryBuilder } from "typeorm";

// ── Frontend-compatible shapes ──────────────────────────────

interface FrontendBrand {
  _id: string;
  title: string;
  slug: { current: string };
}

interface FrontendCategory {
  _id: string;
  title: string;
  slug: { current: string };
  subtypes?: string[];
}

interface FrontendStyle {
  _id: string;
  title: string;
  slug: { current: string };
}

interface FrontendProduct {
  _id: string;
  title: string;
  slug: { current: string };
  description?: string | null;
  price: number;
  originalPrice?: number | null;
  images: string[];
  videos?: string[];
  model3d?: string | null;
  category: (FrontendCategory & { subtypes?: string[] }) | null;
  subtype?: string | null;
  style: FrontendStyle | null;
  brand: FrontendBrand | null;
  sizes: string[];
  colors: string[];
  isHotDrop?: boolean;
  isOnSale?: boolean;
  isNewArrival?: boolean;
}

// ── Adapters ────────────────────────────────────────────────

export function toFrontendProduct(p: Product): FrontendProduct {
  return {
    _id: String(p.id),
    title: p.title,
    slug: { current: p.slug },
    description: p.description,
    price: Number(p.price),
    originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
    images: (p.images || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i) => i.url),
    videos: (p.videos || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v) => v.url),
    model3d: p.model3dUrl || null,
    category: p.category
      ? {
          _id: String(p.category.id),
          title: p.category.title,
          slug: { current: p.category.slug },
          subtypes: p.category.subtypes || undefined,
        }
      : null,
    subtype: p.subtype,
    style: p.style
      ? {
          _id: String(p.style.id),
          title: p.style.title,
          slug: { current: p.style.slug },
        }
      : null,
    brand: p.brand
      ? {
          _id: String(p.brand.id),
          title: p.brand.title,
          slug: { current: p.brand.slug },
        }
      : null,
    sizes: p.sizes || [],
    colors: p.colors || [],
    isHotDrop: p.isHotDrop,
    isOnSale: p.isOnSale,
    isNewArrival: p.isNewArrival,
  };
}

export function toFrontendBrand(b: Brand): FrontendBrand {
  return {
    _id: String(b.id),
    title: b.title,
    slug: { current: b.slug },
  };
}

export function toFrontendCategory(c: Category): FrontendCategory & { image: string | null } {
  return {
    _id: String(c.id),
    title: c.title,
    slug: { current: c.slug },
    subtypes: c.subtypes || undefined,
    image: c.imageUrl,
  };
}

export function toFrontendStyle(s: Style): FrontendStyle {
  return {
    _id: String(s.id),
    title: s.title,
    slug: { current: s.slug },
  };
}

// ── Helpers ─────────────────────────────────────────────────

const FULL_RELATIONS = ["brand", "category", "style", "images", "videos"] as const;

function baseQuery(alias = "p"): Promise<SelectQueryBuilder<Product>> {
  return getDataSource().then((ds) =>
    ds
      .getRepository(Product)
      .createQueryBuilder(alias)
      .leftJoinAndSelect(`${alias}.brand`, "brand")
      .leftJoinAndSelect(`${alias}.category`, "category")
      .leftJoinAndSelect(`${alias}.style`, "style")
      .leftJoinAndSelect(`${alias}.images`, "images")
      .leftJoinAndSelect(`${alias}.videos`, "videos")
  );
}

// ── Repository functions ────────────────────────────────────

export interface FilterParams {
  style?: string;
  brand?: string;
  category?: string;
  subtype?: string;
  saleOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  offset?: number;
  limit?: number;
}

export async function findByFilter(params: FilterParams) {
  const qb = await baseQuery();

  if (params.saleOnly) qb.andWhere("p.isOnSale = :sale", { sale: true });
  if (params.style) qb.andWhere("style.slug = :style", { style: params.style });
  if (params.brand) qb.andWhere("brand.slug = :brand", { brand: params.brand });
  if (params.category) qb.andWhere("category.slug = :category", { category: params.category });
  if (params.subtype) qb.andWhere("p.subtype = :subtype", { subtype: params.subtype });
  if (params.minPrice != null) qb.andWhere("p.price >= :minPrice", { minPrice: params.minPrice });
  if (params.maxPrice != null) qb.andWhere("p.price <= :maxPrice", { maxPrice: params.maxPrice });

  qb.orderBy("p.isHotDrop", "DESC")
    .addOrderBy("p.isNewArrival", "DESC")
    .addOrderBy("p.createdAt", "DESC");

  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  qb.skip(offset).take(limit);

  const [products, total] = await qb.getManyAndCount();
  return { products: products.map(toFrontendProduct), total };
}

export async function findHotDrops(offset = 0, limit = 20) {
  const qb = await baseQuery();
  qb.where("p.isHotDrop = :hot", { hot: true })
    .andWhere("p.isOnSale != :sale", { sale: true })
    .orderBy("p.createdAt", "DESC")
    .skip(offset)
    .take(limit);

  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findSale(offset = 0, limit = 20) {
  const qb = await baseQuery();
  qb.where("p.isOnSale = :sale", { sale: true })
    .orderBy("p.createdAt", "DESC")
    .skip(offset)
    .take(limit);

  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findFreshArrivals(offset = 0, limit = 20) {
  const qb = await baseQuery();
  qb.where("p.isNewArrival = :fresh", { fresh: true })
    .orderBy("p.createdAt", "DESC")
    .skip(offset)
    .take(limit);

  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findEssentials() {
  const ds = await getDataSource();
  const products = await ds.getRepository(Product).find({
    where: { isEssential: true },
    relations: ["brand", "images"],
    order: { createdAt: "DESC" },
    take: 10,
  });

  return products.map((p) => ({
    _id: String(p.id),
    title: p.title,
    slug: { current: p.slug },
    price: Number(p.price),
    images: (p.images || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, 1)
      .map((i) => i.url),
    brand: p.brand
      ? { _id: String(p.brand.id), title: p.brand.title, slug: { current: p.brand.slug } }
      : null,
    subtype: p.subtype,
  }));
}

export async function findBySlug(slug: string) {
  const ds = await getDataSource();
  const product = await ds.getRepository(Product).findOne({
    where: { slug },
    relations: [...FULL_RELATIONS],
  });
  return product ? toFrontendProduct(product) : null;
}

export async function findByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const qb = await baseQuery();
  qb.where("p.id IN (:...ids)", { ids });
  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findByTitles(titles: string[]) {
  if (titles.length === 0) return [];
  const ds = await getDataSource();
  const qb = ds
    .getRepository(Product)
    .createQueryBuilder("p")
    .where("p.title IN (:...titles)", { titles });
  const products = await qb.getMany();
  return products.map((p) => ({
    _id: String(p.id),
    title: p.title,
    price: Number(p.price),
  }));
}

export async function searchProducts(terms: string, limit = 80) {
  const qb = await baseQuery();

  const likeTerm = `%${terms}%`;

  qb.where(
    new Brackets((sub) => {
      sub
        .where("MATCH(p.title, p.description, p.subtype) AGAINST (:terms IN BOOLEAN MODE)", {
          terms: terms
            .split(/\s+/)
            .filter(Boolean)
            .map((t) => `+${t}*`)
            .join(" "),
        })
        .orWhere("brand.title LIKE :likeTerm", { likeTerm })
        .orWhere("category.title LIKE :likeTerm", { likeTerm })
        .orWhere("style.title LIKE :likeTerm", { likeTerm });
    })
  )
    .orderBy("p.updatedAt", "DESC")
    .take(limit);

  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findRelated(
  excludeId: number,
  brandId: number | null,
  styleId: number | null,
  categoryId: number | null,
  limit = 6
) {
  const qb = await baseQuery();
  qb.where("p.id != :excludeId", { excludeId });

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (brandId) {
    conditions.push("p.brandId = :brandId");
    params.brandId = brandId;
  }
  if (styleId) {
    conditions.push("p.styleId = :styleId");
    params.styleId = styleId;
  }
  if (categoryId) {
    conditions.push("p.categoryId = :categoryId");
    params.categoryId = categoryId;
  }

  if (conditions.length > 0) {
    qb.andWhere(new Brackets((sub) => {
      conditions.forEach((c, i) => {
        if (i === 0) sub.where(c, params);
        else sub.orWhere(c, params);
      });
    }));
  }

  qb.orderBy("p.isHotDrop", "DESC")
    .addOrderBy("p.createdAt", "DESC")
    .take(limit);

  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findDistinctSubtypes(params: FilterParams) {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(Product)
    .createQueryBuilder("p")
    .select("DISTINCT p.subtype", "subtype")
    .leftJoin("p.brand", "brand")
    .leftJoin("p.category", "category")
    .leftJoin("p.style", "style");

  if (params.saleOnly) qb.andWhere("p.isOnSale = :sale", { sale: true });
  if (params.style) qb.andWhere("style.slug = :style", { style: params.style });
  if (params.brand) qb.andWhere("brand.slug = :brand", { brand: params.brand });
  if (params.category) qb.andWhere("category.slug = :category", { category: params.category });
  if (params.minPrice != null) qb.andWhere("p.price >= :minPrice", { minPrice: params.minPrice });
  if (params.maxPrice != null) qb.andWhere("p.price <= :maxPrice", { maxPrice: params.maxPrice });

  const rows = await qb.getRawMany<{ subtype: string | null }>();
  return rows.map((r) => r.subtype).filter(Boolean) as string[];
}

export async function findAllSlugs() {
  const ds = await getDataSource();
  const products = await ds.getRepository(Product).find({
    select: ["slug"],
  });
  return products.map((p) => p.slug);
}

export async function findAllSlugsWithDates() {
  const ds = await getDataSource();
  const products = await ds.getRepository(Product).find({
    select: ["slug", "updatedAt"],
  });
  return products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt }));
}

export async function findByBrandSlugs(
  brandSlugs: string[],
  excludeIds: number[],
  limit: number
) {
  if (brandSlugs.length === 0) return [];
  const qb = await baseQuery();
  qb.where("brand.slug IN (:...brandSlugs)", { brandSlugs })
    .orderBy("p.createdAt", "DESC")
    .take(limit);
  if (excludeIds.length > 0) {
    qb.andWhere("p.id NOT IN (:...excludeIds)", { excludeIds });
  }
  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findByPreferenceIds(
  brandIds: number[],
  styleIds: number[],
  excludeIds: number[],
  limit: number
) {
  if (brandIds.length === 0 && styleIds.length === 0) return [];
  const qb = await baseQuery();

  qb.where(
    new Brackets((sub) => {
      if (brandIds.length > 0) sub.where("p.brandId IN (:...brandIds)", { brandIds });
      if (styleIds.length > 0) sub.orWhere("p.styleId IN (:...styleIds)", { styleIds });
    })
  )
    .orderBy("p.createdAt", "DESC")
    .take(limit);

  if (excludeIds.length > 0) {
    qb.andWhere("p.id NOT IN (:...excludeIds)", { excludeIds });
  }

  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findCrossSell(
  subtypes: string[],
  brandSlugs: string[],
  excludeIds: number[],
  maxPrice: number,
  limit: number
) {
  if (subtypes.length === 0) return [];
  const qb = await baseQuery();
  qb.where("LOWER(p.subtype) IN (:...subtypes)", { subtypes: subtypes.map((s) => s.toLowerCase()) })
    .orderBy("p.createdAt", "DESC")
    .take(limit);
  if (excludeIds.length > 0) {
    qb.andWhere("p.id NOT IN (:...excludeIds)", { excludeIds });
  }
  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

export async function findCrossSellFallback(
  brandSlugs: string[],
  cartSubtypes: string[],
  excludeIds: number[],
  maxPrice: number,
  limit: number
) {
  if (brandSlugs.length === 0) return [];
  const qb = await baseQuery();
  qb.where("brand.slug IN (:...brandSlugs)", { brandSlugs })
    .andWhere("p.price <= :maxPrice", { maxPrice })
    .orderBy("p.createdAt", "DESC")
    .take(limit);
  if (cartSubtypes.length > 0) {
    qb.andWhere("LOWER(p.subtype) NOT IN (:...cartSubtypes)", {
      cartSubtypes: cartSubtypes.map((s) => s.toLowerCase()),
    });
  }
  if (excludeIds.length > 0) {
    qb.andWhere("p.id NOT IN (:...excludeIds)", { excludeIds });
  }
  const products = await qb.getMany();
  return products.map(toFrontendProduct);
}

// ── Catalog queries ─────────────────────────────────────────

export async function findAllBrands() {
  const ds = await getDataSource();
  const brands = await ds.getRepository(Brand).find({
    order: { isFeatured: "DESC", title: "ASC" },
  });
  return brands.map(toFrontendBrand);
}

export async function findAllCategories() {
  const ds = await getDataSource();
  const categories = await ds.getRepository(Category).find({
    order: { title: "ASC" },
  });
  return categories.map(toFrontendCategory);
}

export async function findAllStyles() {
  const ds = await getDataSource();
  const styles = await ds.getRepository(Style).find({
    order: { isFeatured: "DESC", title: "ASC" },
  });
  return styles.map(toFrontendStyle);
}
