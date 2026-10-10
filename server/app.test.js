import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";
import { createApp } from "./app.js";
import { createDatabase } from "./database.js";

const db = createDatabase(":memory:");
const app = createApp({ db });
let createdId;

before(async () => {
  const response = await request(app).get("/api/products");
  assert.equal(response.status, 200);
  assert.equal(response.body.length, 7);
});

after(() => db.close());

test("creates products and rejects duplicate SKUs", async () => {
  const payload = {
    name: "Test Oat Milk",
    sku: "TEST-100",
    category: "Dairy alternatives",
    price: 3.5,
    stock: 6,
    reorderLevel: 4,
  };
  const created = await request(app).post("/api/products").send(payload);
  assert.equal(created.status, 201);
  assert.equal(created.body.name, payload.name);
  createdId = created.body.id;

  const duplicate = await request(app).post("/api/products").send(payload);
  assert.equal(duplicate.status, 409);
});

test("validates product data and prevents negative stock", async () => {
  const invalid = await request(app)
    .post("/api/products")
    .send({ name: "", sku: "BAD", category: "Food", price: 2, stock: -1, reorderLevel: 1 });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.body.fields.name);
  assert.ok(invalid.body.fields.stock);

  const negative = await request(app)
    .patch(`/api/products/${createdId}/stock`)
    .send({ delta: -7 });
  assert.equal(negative.status, 400);
});

test("returns a clear validation error for malformed JSON", async () => {
  const response = await request(app)
    .post("/api/products")
    .set("Content-Type", "application/json")
    .send("{invalid json");
  assert.equal(response.status, 400);
  assert.match(response.body.error, /valid JSON/i);
});

test("adjusts stock, edits products, and removes them", async () => {
  const adjusted = await request(app)
    .patch(`/api/products/${createdId}/stock`)
    .send({ delta: 3 });
  assert.equal(adjusted.status, 200);
  assert.equal(adjusted.body.stock, 9);

  const edited = await request(app)
    .put(`/api/products/${createdId}`)
    .send({
      name: "Test Oat Milk Unsweetened",
      sku: "TEST-100",
      category: "Dairy alternatives",
      price: 3.75,
      stock: 9,
      reorderLevel: 5,
    });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.name, "Test Oat Milk Unsweetened");

  const removed = await request(app).delete(`/api/products/${createdId}`);
  assert.equal(removed.status, 204);
  const missing = await request(app).get("/api/products").then((response) =>
    response.body.find((product) => product.id === createdId),
  );
  assert.equal(missing, undefined);
});
