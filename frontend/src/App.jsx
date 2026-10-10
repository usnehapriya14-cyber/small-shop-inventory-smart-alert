import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  LayoutDashboard,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || "Request failed.");
    error.fields = body.fields || {};
    throw error;
  }
  return body;
}

function getStatus(product) {
  if (product.stock === 0) return "out";
  if (product.stock <= product.reorderLevel) return "low";
  return "healthy";
}

function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All items");
  const [category, setCategory] = useState("All categories");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  async function loadProducts() {
    setLoadError("");
    try {
      setProducts(await api("/products"));
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const stats = useMemo(() => {
    const low = products.filter((product) => getStatus(product) === "low");
    const out = products.filter((product) => getStatus(product) === "out");
    const stockValue = products.reduce(
      (total, product) => total + product.price * product.stock,
      0,
    );
    return {
      total: products.length,
      alerts: low.length + out.length,
      low: low.length,
      out: out.length,
      stockValue,
    };
  }, [products]);

  const categories = useMemo(
    () => ["All categories", ...new Set(products.map((product) => product.category))],
    [products],
  );

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !normalized ||
        [product.name, product.sku, product.category].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      const status = getStatus(product);
      const matchesFilter =
        filter === "All items" ||
        (filter === "Low stock" && status === "low") ||
        (filter === "Out of stock" && status === "out");
      return (
        matchesSearch &&
        matchesFilter &&
        (category === "All categories" || product.category === category)
      );
    });
  }, [products, query, filter, category]);

  async function adjustStock(product, delta) {
    try {
      const updated = await api(`/products/${product.id}/stock`, {
        method: "PATCH",
        body: JSON.stringify({ delta }),
      });
      setProducts((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setToast(delta > 0 ? "Stock restocked" : "Stock updated");
    } catch (error) {
      setToast(error.message);
    }
  }

  async function saveProduct(product) {
    try {
      const saved = product.id
        ? await api(`/products/${product.id}`, {
            method: "PUT",
            body: JSON.stringify(product),
          })
        : await api("/products", {
            method: "POST",
            body: JSON.stringify(product),
          });
      setProducts((items) =>
        product.id
          ? items.map((item) => (item.id === saved.id ? saved : item))
          : [...items, saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setModal(null);
      setToast(product.id ? "Product changes saved" : "Product added to inventory");
    } catch (error) {
      return error;
    }
    return null;
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Remove ${product.name} from your inventory?`)) return;
    try {
      await api(`/products/${product.id}`, { method: "DELETE" });
      setProducts((items) => items.filter((item) => item.id !== product.id));
      setModal(null);
      setToast("Product removed");
    } catch (error) {
      setToast(error.message);
    }
  }

  const lowProducts = products
    .filter((product) => getStatus(product) !== "healthy")
    .sort((a, b) => a.stock - b.stock);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Little Ledger home">
          <span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.4} /></span>
          <span>little<span className="brand-light">ledger</span></span>
        </a>
        <div className="shop-switcher">
          <span className="shop-avatar">M</span>
          <span className="shop-copy"><strong>Maple & Main</strong><small>My shop</small></span>
          <ChevronDown size={15} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#overview"><LayoutDashboard size={18} /> Overview</a>
          <a className="active" href="#inventory"><Boxes size={18} /> Inventory <span className="nav-count">{products.length}</span></a>
          <a href="#alerts" onClick={() => setFilter("Low stock")}><Bell size={18} /> Alerts {stats.alerts > 0 && <span className="nav-dot" />}</a>
          <a href="#reports"><ClipboardList size={18} /> Reports</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><Sparkles size={17} /></span>
            <strong>Less counting,<br />more doing.</strong>
            <p>Your stockroom, sorted.</p>
            <div className="help-squiggle">✳</div>
          </div>
          <a className="settings-link" href="#settings"><Settings2 size={17} /> Settings</a>
          <div className="profile">
            <span className="profile-avatar">S</span>
            <span><strong>Sam Taylor</strong><small>Shop owner</small></span>
            <ChevronDown size={15} />
          </div>
        </div>
      </aside>

      <main className="main-area" id="overview">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Inventory</strong></div>
          <div className="topbar-right">
            <span className="today-label">Saturday, October 10</span>
            <button className="icon-button notification-button" aria-label="View alerts" onClick={() => setFilter("Low stock")}>
              <Bell size={18} />{stats.alerts > 0 && <span className="notification-dot" />}
            </button>
            <span className="top-avatar">S</span>
          </div>
        </header>

        <section className="page-content" id="inventory">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="live-dot" /> YOUR SHOP AT A GLANCE</div>
              <h1>Inventory <span className="heading-spark">✳</span></h1>
              <p className="page-subtitle">A little order goes a long way. Here’s how things are looking.</p>
            </div>
            <button className="button button-primary" onClick={() => setModal({ type: "product" })}>
              <Plus size={17} /> Add a product
            </button>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <div className="stat-top"><span>Products tracked</span><span className="stat-icon icon-lavender"><Package size={17} /></span></div>
              <div className="stat-value">{stats.total}<span className="stat-unit"> items</span></div>
              <div className="stat-foot"><span className="foot-dot dot-green" /> Everything in one place</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Needs a little love</span><span className="stat-icon icon-peach"><AlertTriangle size={17} /></span></div>
              <div className="stat-value">{stats.alerts}<span className="stat-unit"> items</span></div>
              <div className="stat-foot"><span className="foot-dot dot-peach" /> At or below reorder point</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Out of stock</span><span className="stat-icon icon-rose"><CircleAlert size={17} /></span></div>
              <div className="stat-value">{stats.out}<span className="stat-unit"> items</span></div>
              <div className="stat-foot">{stats.out ? <><span className="foot-dot dot-rose" /> Could use a restock</> : <><span className="foot-dot dot-green" /> All clear here</>}</div>
            </article>
            <article className="stat-card">
              <div className="stat-top"><span>Stock value</span><span className="stat-icon icon-mint"><ShoppingBag size={17} /></span></div>
              <div className="stat-value">{currency.format(stats.stockValue)}</div>
              <div className="stat-foot"><span className="foot-dot dot-green" /> Value at retail price</div>
            </article>
          </div>

          {lowProducts.length > 0 && (
            <section className="alert-banner" id="alerts" aria-label="Stock alerts">
              <span className="alert-banner-icon"><Bell size={17} /></span>
              <div className="alert-banner-copy">
                <strong>A small heads-up</strong>
                <span>{lowProducts.length} {lowProducts.length === 1 ? "item is" : "items are"} running low and could use a restock.</span>
              </div>
              <div className="alert-chips">
                {lowProducts.slice(0, 3).map((product) => (
                  <button key={product.id} className="alert-chip" onClick={() => setFilter(product.stock === 0 ? "Out of stock" : "Low stock")}>
                    <span className={product.stock === 0 ? "chip-dot chip-out" : "chip-dot"} />
                    {product.name}
                  </button>
                ))}
                {lowProducts.length > 3 && <span className="more-alerts">+{lowProducts.length - 3} more</span>}
              </div>
              <button className="banner-link" onClick={() => setFilter("Low stock")}>See alerts <ArrowUp size={14} /></button>
            </section>
          )}

          <section className="inventory-panel">
            <div className="panel-heading">
              <div>
                <div className="panel-title-row"><h2>Your products</h2><span className="count-pill">{products.length}</span></div>
                <p>A cozy little overview of everything on your shelves.</p>
              </div>
              <button className="button button-soft" onClick={() => setModal({ type: "product" })}><Plus size={16} /> Add product</button>
            </div>
            <div className="table-toolbar">
              <div className="filter-tabs">
                {["All items", "Low stock", "Out of stock"].map((item) => (
                  <button key={item} className={`filter-tab ${filter === item ? "selected" : ""}`} onClick={() => setFilter(item)}>
                    {item}{item === "Low stock" && stats.low > 0 && <span className="tab-badge">{stats.low}</span>}
                  </button>
                ))}
              </div>
              <div className="toolbar-controls">
                <label className="search-field">
                  <Search size={16} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." aria-label="Search products" />
                  {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
                </label>
                <label className="category-select">
                  <SlidersHorizontal size={15} />
                  <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
                    {categories.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
            </div>

            {loadError && <div className="error-message"><CircleAlert size={17} />{loadError}<button onClick={loadProducts}>Try again</button></div>}
            {loading ? (
              <div className="empty-state"><LoaderCircle className="spinner" size={24} /><span>Getting your shelves in order...</span></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>PRICE</th><th>IN STOCK</th><th>REORDER AT</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr>
                  </thead>
                  <tbody>
                    {visibleProducts.map((product) => {
                      const status = getStatus(product);
                      return (
                        <tr key={product.id}>
                          <td><button className="product-name" onClick={() => setModal({ type: "product", product })}><span className={`product-thumb ${categoryColor(product.category)}`}><Package size={17} /></span><span>{product.name}<small>Updated just now</small></span></button></td>
                          <td className="sku-cell">{product.sku}</td>
                          <td><span className="category-tag">{product.category}</span></td>
                          <td className="price-cell">{currency.format(product.price)}</td>
                          <td><div className="stock-control"><button aria-label={`Remove one ${product.name}`} disabled={product.stock === 0} onClick={() => adjustStock(product, -1)}><Minus size={13} /></button><span>{product.stock}</span><button aria-label={`Add one ${product.name}`} onClick={() => adjustStock(product, 1)}><Plus size={13} /></button></div></td>
                          <td className="reorder-cell">{product.reorderLevel} units</td>
                          <td><StatusBadge status={status} /></td>
                          <td><button className="row-more" aria-label={`Edit ${product.name}`} onClick={() => setModal({ type: "product", product })}>···</button></td>
                        </tr>
                      );
                    })}
                    {!visibleProducts.length && (
                      <tr><td colSpan="8"><div className="empty-state"><Package size={24} /><strong>No products found</strong><span>Try a different search or add something new.</span></div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-footer">
              <span>Showing <strong>{visibleProducts.length}</strong> of <strong>{products.length}</strong> products</span>
              <span className="footer-note"><Check size={14} /> All changes saved</span>
            </div>
          </section>
          <footer className="page-footer"><span>Made for the little things that make a shop.</span><span>Little Ledger <span className="footer-heart">✳</span> 2026</span></footer>
        </section>
      </main>

      {modal?.type === "product" && <ProductModal product={modal.product} onClose={() => setModal(null)} onSave={saveProduct} onDelete={deleteProduct} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const content = {
    healthy: <><span className="status-dot" /> In stock</>,
    low: <><span className="status-dot" /> Low stock</>,
    out: <><span className="status-dot" /> Out of stock</>,
  }[status];
  return <span className={`status-badge status-${status}`}>{content}</span>;
}

function categoryColor(category) {
  const colors = {
    Pantry: "thumb-lilac",
    Dairy: "thumb-blue",
    "Dairy alternatives": "thumb-blue",
    Drinks: "thumb-peach",
    Household: "thumb-mint",
    Bakery: "thumb-yellow",
    Snacks: "thumb-pink",
  };
  return colors[category] || "thumb-lilac";
}

function ProductModal({ product, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({
    name: product?.name || "",
    sku: product?.sku || "",
    category: product?.category || "",
    price: product?.price ?? "",
    stock: product?.stock ?? 0,
    reorderLevel: product?.reorderLevel ?? 5,
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function update(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: "" }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await onSave({
      ...form,
      id: product?.id,
      price: Number(form.price),
      stock: Number(form.stock),
      reorderLevel: Number(form.reorderLevel),
    });
    setSaving(false);
    if (result) {
      setError(result.message);
      setFieldErrors(result.fields || {});
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <div><span className="modal-kicker">{product ? "A LITTLE TIDY-UP" : "GROW YOUR SHELVES"}</span><h2 id="modal-title">{product ? "Edit product" : "Add a product"}</h2></div>
          <button className="icon-button close-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        </div>
        <p className="modal-description">{product ? "Keep the details fresh and up to date." : "Add the details and we’ll keep an eye on stock for you."}</p>
        <form onSubmit={submit} noValidate>
          <div className="form-grid">
            <label className="form-field form-wide">Product name<input autoFocus required name="name" value={form.name} onChange={update} placeholder="e.g. House blend coffee" maxLength="80" /><FieldError>{fieldErrors.name}</FieldError></label>
            <label className="form-field">SKU<input required name="sku" value={form.sku} onChange={update} placeholder="e.g. COF-001" maxLength="30" /><FieldError>{fieldErrors.sku}</FieldError></label>
            <label className="form-field">Category<input required name="category" value={form.category} onChange={update} placeholder="e.g. Drinks" maxLength="50" /><FieldError>{fieldErrors.category}</FieldError></label>
            <label className="form-field">Price ($)<input required name="price" type="number" min="0" max="1000000" step="0.01" value={form.price} onChange={update} placeholder="0.00" /><FieldError>{fieldErrors.price}</FieldError></label>
            <label className="form-field">Units in stock<input name="stock" type="number" min="0" step="1" value={form.stock} onChange={update} /><FieldError>{fieldErrors.stock}</FieldError></label>
            <label className="form-field form-wide">Alert me when stock reaches<input name="reorderLevel" type="number" min="0" step="1" value={form.reorderLevel} onChange={update} /><span className="field-hint">We’ll flag this product when it hits this number.</span><FieldError>{fieldErrors.reorderLevel}</FieldError></label>
          </div>
          {error && <div className="form-error" role="alert"><CircleAlert size={15} />{error}</div>}
          <div className="modal-actions">
            {product && <button type="button" className="delete-button" onClick={() => onDelete(product)}>Remove product</button>}
            <span className="action-spacer" />
            <button type="button" className="button button-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : product ? "Save changes" : <><Plus size={16} /> Add product</>}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function FieldError({ children }) {
  return children ? <span className="field-error">{children}</span> : null;
}

export default App;
