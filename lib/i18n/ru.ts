/**
 * Russian translations for FreeWayz app.
 * Prices are displayed in Uzbekistan so'm (UZS).
 */
export const ru = {
  // Layout & nav
  navHome: "Главная",
  navCart: "Корзина",
  navProfile: "Профиль",
  back: "Назад",
  searchPlaceholder: "Поиск...",

  // Home
  sectionHotDrops: "Хот продажи",
  sectionSaleSteal: "Скидки",
  sectionFreshArrivals: "НОВИНКИ",
  sectionFilteredResults: "РЕЗУЛЬТАТЫ ПОИСКА",
  sectionSearchResults: "Результаты поиска",
  searchNoResults: "Ничего не найдено",
  viewAll: "Всё",

  // Filters
  filters: "ФИЛЬТРЫ",
  saleOnly: "Только скидки",
  styles: "Стили",
  brands: "Бренды",
  categories: "Категории",
  subtypes: "Подтип",
  noSubtypes: "Выберите категорию",
  noCategoriesYet: "Категорий пока нет — создайте их в",
  studio: "/studio",
  clearAllFilters: "Сбросить фильтры",
  applyFilters: "Применить",

  // Cart
  cart: "КОРЗИНА",
  yourCartIsEmpty: "Корзина пуста",
  cartEmptyHint: "Вы ещё ничего не добавили",
  continueShopping: "Продолжить покупки",
  item: "товар",
  items: "товара",
  itemsMany: "товаров",
  clearAll: "Очистить",
  total: "Итого",
  checkoutViaTelegram: "Оформить в Telegram",
  size: "Размер",

  // Product
  productNotFound: "Товар не найден",
  goBack: "Назад",
  addToCart: "В корзину",
  description: "Описание",
  quickView: "Быстрый просмотр",
  viewDetails: "Полное описание",
  youMightAlsoLike: "С этим также покупают",
  view3D: "3D модель",
  view3DLoading: "Загрузка 3D…",
  adding: "Добавляем...",
  added: "Добавлено!",
  pleaseSelectSize: "Выберите размер",
  addedToCart: "Добавлено в корзину",

  // Product card
  sale: "SALE",
  hot: "🔥 HOT",
  noImage: "Нет фото",

  // Profile
  profile: "ПРОФИЛЬ",
  guestUser: "Гость",
  currentStatus: "Текущий статус",
  progressTo: "До уровня",
  left: "осталось",
  totalSpent: "Потрачено",
  cashback: "Кэшбэк",
  statusTiers: "Уровни статуса",
  statusRookie: "Новичок",
  statusPro: "Про",
  statusLegend: "Легенда",
  cashbackRookie: "3% кэшбэк",
  cashbackPro: "5% кэшбэк",
  cashbackLegend: "10% кэшбэк",
  tierRookieRange: "0 — 4 млн сўм",
  tierProRange: "4 — 7 млн сўм",
  tierLegendRange: "7 млн+ сўм",
  leftToSpend: "Осталось потратить",
  forStatus: "для перехода на уровень",
  maxStatusReached: "🏆 Вы достигли максимального статуса! Скидка 10% работает всегда.",

  // Toast / generic
  loading: "Загрузка...",
  allProductsLoaded: "Все товары загружены",
  priceRange: "Цена",
  found: "Найдено",
  share: "Поделиться",
  linkCopied: "Ссылка скопирована",
  guest: "Гость",
} as const;

export type RuKeys = keyof typeof ru;

/** Russian plural for "item" (1 товар, 2 товара, 5 товаров) */
export function itemsCount(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return `${n} ${ru.itemsMany}`;
  if (mod10 === 1) return `${n} ${ru.item}`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} ${ru.items}`;
  return `${n} ${ru.itemsMany}`;
}
