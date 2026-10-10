import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const demoProducts = [
  ["Basmati Rice 5kg", "PAN-001", "Pantry", 12.99, 18, 8],
  ["Whole Milk 1L", "DAI-014", "Dairy", 2.49, 4, 10],
  ["Arabica Coffee", "BEV-022", "Drinks", 8.75, 0, 5],
  ["Olive Oil 500ml", "PAN-018", "Pantry", 9.5, 12, 6],
  ["Dish Soap", "HOM-006", "Household", 3.25, 3, 6],
  ["Sourdough Loaf", "BAK-009", "Bakery", 4.0, 7, 4],
  ["Dark Chocolate", "SNK-031", "Snacks", 2.99, 22, 8],
];

export function createDatabase(filename = path.resolve("data/inventory.db")) {
  if (filename !== ":memory:") {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
      category TEXT NOT NULL,
      price REAL NOT NULL CHECK (price >= 0),
      stock INTEGER NOT NULL CHECK (stock >= 0),
      reorder_level INTEGER NOT NULL CHECK (reorder_level >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  if (count === 0) {
    const insert = db.prepare(`
      INSERT INTO products (name, sku, category, price, stock, reorder_level)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    db.exec("BEGIN");
    try {
      for (const product of demoProducts) insert.run(...product);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return db;
}
