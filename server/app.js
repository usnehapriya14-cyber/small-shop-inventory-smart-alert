import fs from "node:fs";
import path from "node:path";
import express from "express";
import { createDatabase } from "./database.js";

const productFields = `
  id,
  name,
  sku,
  category,
  price,
  stock,
  reorder_level AS reorderLevel,
  created_at AS createdAt
`;

function validateProduct(input) {
  const errors = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const sku = typeof input.sku === "string" ? input.sku.trim() : "";
  const category =
    typeof input.category === "string" ? input.category.trim() : "";
  const price = input.price;
  const stock = input.stock;
  const reorderLevel = input.reorderLevel;

  if (name.length < 2 || name.length > 80) {
    errors.name = "Name must be between 2 and 80 characters.";
  }
  if (sku.length < 1 || sku.length > 30) {
    errors.sku = "SKU must be between 1 and 30 characters.";
  }
  if (category.length < 1 || category.length > 50) {
    errors.category = "Category must be between 1 and 50 characters.";
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0 || price > 1_000_000) {
    errors.price = "Price must be a number between 0 and 1,000,000.";
  }
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
    errors.stock = "Stock must be a whole number between 0 and 1,000,000.";
  }
  if (
    !Number.isInteger(reorderLevel) ||
    reorderLevel < 0 ||
    reorderLevel > 1_000_000
  ) {
    errors.reorderLevel =
      "Reorder level must be a whole number between 0 and 1,000,000.";
  }

  return {
    errors,
    product: { name, sku, category, price, stock, reorderLevel },
  };
}

function isUniqueViolation(error) {
  return error?.code === "SQLITE_CONSTRAINT_UNIQUE" || error?.errcode === 2067;
}

export function createApp({ db = createDatabase() } = {}) {
  const app = express();
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/products", (_req, res) => {
    const products = db
      .prepare(`SELECT ${productFields} FROM products ORDER BY name COLLATE NOCASE`)
      .all();
    res.json(products);
  });

  app.post("/api/products", (req, res, next) => {
    const { errors, product } = validateProduct(req.body ?? {});
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: "Please check the product details.", fields: errors });
    }

    try {
      const result = db
        .prepare(
          `INSERT INTO products (name, sku, category, price, stock, reorder_level)
           VALUES (@name, @sku, @category, @price, @stock, @reorderLevel)`,
        )
        .run(product);
      const created = db
        .prepare(`SELECT ${productFields} FROM products WHERE id = ?`)
        .get(result.lastInsertRowid);
      return res.status(201).json(created);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ error: "That SKU is already in use." });
      }
      return next(error);
    }
  });

  app.put("/api/products/:id", (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Product ID must be a positive integer." });
    }
    const { errors, product } = validateProduct(req.body ?? {});
    if (Object.keys(errors).length) {
      return res.status(400).json({ error: "Please check the product details.", fields: errors });
    }

    try {
      const result = db
        .prepare(
          `UPDATE products
           SET name = @name, sku = @sku, category = @category, price = @price,
               stock = @stock, reorder_level = @reorderLevel
           WHERE id = @id`,
        )
        .run({ ...product, id });
      if (result.changes === 0) {
        return res.status(404).json({ error: "Product not found." });
      }
      const updated = db
        .prepare(`SELECT ${productFields} FROM products WHERE id = ?`)
        .get(id);
      return res.json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return res.status(409).json({ error: "That SKU is already in use." });
      }
      return next(error);
    }
  });

  app.patch("/api/products/:id/stock", (req, res, next) => {
    const id = Number(req.params.id);
    const { delta } = req.body ?? {};
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Product ID must be a positive integer." });
    }
    if (!Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ error: "Stock adjustment must be a non-zero whole number." });
    }

    try {
      const result = db
        .prepare(
          `UPDATE products SET stock = stock + ?
           WHERE id = ? AND stock + ? >= 0 AND stock + ? <= 1000000`,
        )
        .run(delta, id, delta, delta);
      if (result.changes === 0) {
        const exists = db.prepare("SELECT 1 FROM products WHERE id = ?").get(id);
        return res
          .status(exists ? 400 : 404)
          .json({ error: exists ? "Adjustment would result in invalid stock." : "Product not found." });
      }
      const updated = db
        .prepare(`SELECT ${productFields} FROM products WHERE id = ?`)
        .get(id);
      return res.json(updated);
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/products/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: "Product ID must be a positive integer." });
    }
    const result = db.prepare("DELETE FROM products WHERE id = ?").run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Product not found." });
    }
    return res.status(204).end();
  });

  const distDirectory = path.resolve("dist");
  const indexFile = path.join(distDirectory, "index.html");
  if (fs.existsSync(indexFile)) {
    app.use(express.static(distDirectory));
    app.get("/{*splat}", (_req, res) => res.sendFile(indexFile));
  }

  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return res.status(400).json({ error: "Request body must contain valid JSON." });
    }
    console.error(error);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  return app;
}
