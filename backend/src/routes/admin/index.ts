import { Hono } from "hono";
import { adminAuthRoutes } from "./auth.js";
import { adminCustomersRoutes } from "./customers.js";
import { adminOrdersRoutes } from "./orders.js";
import { adminFinanceRoutes } from "./finance.js";
import { adminPromoRoutes } from "./promo.js";
import { adminSuppliersRoutes } from "./suppliers.js";
import { adminProductsRoutes } from "./products.js";

const app = new Hono();

app.route("/", adminAuthRoutes);
app.route("/customers", adminCustomersRoutes);
app.route("/orders", adminOrdersRoutes);
app.route("/finance", adminFinanceRoutes);
app.route("/promo", adminPromoRoutes);
app.route("/suppliers", adminSuppliersRoutes);
app.route("/products", adminProductsRoutes);

export { app as adminRoutes };
