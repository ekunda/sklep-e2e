// Prosty frontend bez frameworka. Stan logowania trzymamy w localStorage
// pod kluczem "auth_token" (tak jak w fixtures Playwright), a koszyk pod "cart".

const TOKEN_KEY = "auth_token";
const CART_KEY = "cart";

const getToken = () => localStorage.getItem(TOKEN_KEY);
const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
const clearToken = () => localStorage.removeItem(TOKEN_KEY);

function requireAuth() {
  if (!getToken()) {
    window.location.href = "/login.html";
    return false;
  }
  return true;
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ---- Koszyk (localStorage) ----
const getCart = () => JSON.parse(localStorage.getItem(CART_KEY) || "[]");
const saveCart = (cart) => localStorage.setItem(CART_KEY, JSON.stringify(cart));
const clearCart = () => localStorage.removeItem(CART_KEY);
const cartCount = () => getCart().reduce((sum, i) => sum + i.quantity, 0);

function addToCart(product) {
  const cart = getCart();
  const existing = cart.find((i) => i.productId === product.id);
  if (existing) existing.quantity += 1;
  else cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
  saveCart(cart);
  renderCartBadge();
}

function renderCartBadge() {
  const badge = document.querySelector('[data-testid="cart-badge"]');
  if (badge) badge.textContent = String(cartCount());
}

function toast(message) {
  let el = document.querySelector('[data-testid="toast"]');
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("data-testid", "toast");
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => (el.hidden = true), 2500);
}

function wireLogout() {
  const btn = document.querySelector('[data-testid="logout"]');
  if (btn) {
    btn.addEventListener("click", () => {
      clearToken();
      clearCart();
      window.location.href = "/login.html";
    });
  }
}

// ---- Inicjalizatory poszczególnych stron ----

async function initLogin() {
  const form = document.querySelector("#login-form");
  const errorBox = document.querySelector('[data-testid="login-error"]');
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";
    try {
      const { token } = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: form.email.value,
          password: form.password.value,
        }),
      });
      setToken(token);
      window.location.href = "/products.html";
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

async function initProducts() {
  if (!requireAuth()) return;
  wireLogout();
  renderCartBadge();

  const grid = document.querySelector("#product-grid");
  const { products } = await api("/api/products");

  if (products.length === 0) {
    grid.innerHTML = '<p class="muted" data-testid="empty-products">Brak produktów</p>';
    return;
  }

  for (const p of products) {
    const card = document.createElement("div");
    card.className = "product-card";
    card.setAttribute("data-testid", `product-${p.id}`);
    card.innerHTML = `
      <h3>${p.name}</h3>
      <p class="price">${p.price} zł</p>
      <p class="muted">Na stanie: ${p.stock}</p>
      <button type="button">Dodaj do koszyka</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      addToCart(p);
      toast("Dodano do koszyka");
    });
    grid.appendChild(card);
  }
}

async function initCart() {
  if (!requireAuth()) return;
  wireLogout();
  renderCartBadge();

  const list = document.querySelector("#cart-list");
  const summary = document.querySelector("#cart-summary");
  const cart = getCart();

  if (cart.length === 0) {
    list.innerHTML = '<p class="muted" data-testid="empty-cart">Koszyk jest pusty</p>';
    summary.hidden = true;
    return;
  }

  let total = 0;
  for (const item of cart) {
    total += Number(item.price) * item.quantity;
    const row = document.createElement("div");
    row.className = "cart-row";
    row.setAttribute("data-testid", `cart-item-${item.productId}`);
    row.innerHTML = `
      <span>${item.name} × ${item.quantity}</span>
      <span class="price">${(Number(item.price) * item.quantity).toFixed(2)} zł</span>
    `;
    list.appendChild(row);
  }

  summary.querySelector('[data-testid="cart-total"]').textContent = total.toFixed(2);

  document.querySelector('[data-testid="place-order"]').addEventListener("click", async () => {
    try {
      const items = cart.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      const { order } = await api("/api/orders", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      clearCart();
      window.location.href = `/orders.html?placed=${order.id}`;
    } catch (err) {
      toast(`Błąd: ${err.message}`);
    }
  });
}

async function initOrders() {
  if (!requireAuth()) return;
  wireLogout();
  renderCartBadge();

  const params = new URLSearchParams(window.location.search);
  if (params.has("placed")) {
    const banner = document.querySelector('[data-testid="order-confirmation"]');
    banner.hidden = false;
  }

  const list = document.querySelector("#orders-list");
  const { orders } = await api("/api/orders");

  if (orders.length === 0) {
    list.innerHTML = '<p class="muted" data-testid="empty-orders">Brak zamówień</p>';
    return;
  }

  for (const o of orders) {
    const row = document.createElement("div");
    row.className = "order-row";
    row.setAttribute("data-testid", `order-${o.id}`);
    row.innerHTML = `
      <span>Zamówienie #${o.id} — <strong>${o.status}</strong></span>
      <span class="price">${o.total} zł</span>
    `;
    list.appendChild(row);
  }
}

// Dispatcher — uruchom inicjalizator pasujący do strony.
const PAGES = {
  login: initLogin,
  products: initProducts,
  cart: initCart,
  orders: initOrders,
};

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const init = PAGES[page];
  if (init) init().catch((err) => console.error("[page init]", err));
});
