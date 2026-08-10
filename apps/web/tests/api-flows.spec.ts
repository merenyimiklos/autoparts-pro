import { createHmac } from 'crypto';
import { expect, request as requestFactory, test, type APIRequestContext } from '@playwright/test';

const API = 'http://localhost:4000/api';
const PASSWORD = 'Demo1234!';

async function login(ctx: APIRequestContext, email: string) {
  const r = await ctx.post(`${API}/auth/login`, { data: { email, password: PASSWORD } });
  expect(r.ok(), await r.text()).toBeTruthy();
}

async function clearCart(ctx: APIRequestContext) {
  const cart = await (await ctx.get(`${API}/cart`)).json();
  for (const item of cart.items ?? []) {
    await ctx.patch(`${API}/cart/items`, { data: { productId: item.productId, quantity: 0 } });
  }
}

async function firstAvailableProduct(ctx: APIRequestContext, exclude = new Set<string>()) {
  const data = await (await ctx.get(`${API}/products?limit=50`)).json();
  const product = data.items.find((p: { id: string; available: number }) => p.available > 0 && !exclude.has(p.id));
  expect(product).toBeTruthy();
  return product;
}

const checkout = (email: string, paymentMethod = 'cod') => ({
  email,
  shippingAddress: { recipient: 'Teszt Vásárló', postalCode: '1111', city: 'Budapest', street: 'Teszt utca 1.', country: 'HU' },
  billingAddress: { recipient: 'Teszt Vásárló', postalCode: '1111', city: 'Budapest', street: 'Teszt utca 1.', country: 'HU' },
  paymentMethod,
  shippingMethod: 'home',
});

test('registration creates an unverified account and login works for seeded user', async () => {
  const ctx = await requestFactory.newContext();
  const email = `e2e-${Date.now()}@example.test`;
  const registered = await ctx.post(`${API}/auth/register`, { data: { email, password: 'StrongDemo123!', firstName: 'E2E', lastName: 'Teszt' } });
  expect(registered.status()).toBe(201);
  expect((await registered.json()).requiresVerification).toBe(true);
  await login(ctx, 'customer@autoparts.local');
  expect((await ctx.get(`${API}/auth/me`)).ok()).toBeTruthy();
  await ctx.dispose();
});

test('inventory movement records receipt and scrap without corrupting stock', async () => {
  const ctx = await requestFactory.newContext();
  await login(ctx, 'warehouse@autoparts.local');
  const balances = await (await ctx.get(`${API}/inventory/balances`)).json();
  const row = balances[0];
  const receipt = await ctx.post(`${API}/inventory/adjust`, { data: { productId: row.productId, warehouseId: row.warehouseId, type: 'RECEIPT', quantity: 2, reason: 'E2E bevételezés' } });
  expect(receipt.ok(), await receipt.text()).toBeTruthy();
  const scrap = await ctx.post(`${API}/inventory/adjust`, { data: { productId: row.productId, warehouseId: row.warehouseId, type: 'SCRAP', quantity: 2, reason: 'E2E visszaállítás' } });
  expect(scrap.ok(), await scrap.text()).toBeTruthy();
  await ctx.dispose();
});

test('customer can open a return request for a completed seeded order', async () => {
  const ctx = await requestFactory.newContext();
  await login(ctx, 'customer@autoparts.local');
  const orders = await (await ctx.get(`${API}/orders/mine`)).json();
  const completed = orders.find((o: { status: string }) => o.status === 'COMPLETED');
  expect(completed).toBeTruthy();
  const response = await ctx.post(`${API}/customer/returns`, { data: { orderId: completed.id, reason: 'E2E visszaküldési teszt' } });
  expect(response.status()).toBe(201);
  await ctx.dispose();
});

test('backend RBAC rejects customer product administration', async () => {
  const ctx = await requestFactory.newContext();
  await login(ctx, 'customer@autoparts.local');
  const r = await ctx.post(`${API}/products`, { data: {} });
  expect(r.status()).toBe(403);
  await ctx.dispose();
});

test('vehicle compatibility filter returns fitting/universal products', async () => {
  const ctx = await requestFactory.newContext();
  const brands = await (await ctx.get(`${API}/vehicles/brands`)).json();
  const models = await (await ctx.get(`${API}/vehicles/brands/${brands[0].id}/models`)).json();
  const generations = await (await ctx.get(`${API}/vehicles/models/${models[0].id}/generations`)).json();
  const engines = await (await ctx.get(`${API}/vehicles/generations/${generations[0].id}/engines`)).json();
  const products = await (await ctx.get(`${API}/products?engineId=${engines[0].id}&limit=50`)).json();
  expect(products.items.length).toBeGreaterThan(0);
  expect(products.items.every((p: { fits?: boolean; universal: boolean }) => p.universal || p.fits === true)).toBeTruthy();
  await ctx.dispose();
});

test('automatic manufacturer promotion is applied before checkout', async () => {
  const ctx = await requestFactory.newContext();
  const products = await (await ctx.get(`${API}/products?manufacturer=AutoCore&limit=10`)).json();
  const p = products.items.find((x: { available: number }) => x.available > 0);
  expect(p).toBeTruthy();
  await ctx.post(`${API}/cart/items`, { data: { productId: p.id, quantity: 1 } });
  const cart = await (await ctx.get(`${API}/cart?shippingMethod=pickup`)).json();
  expect(cart.automaticDiscountGross).toBeGreaterThan(0);
  expect(cart.lines[0].promotion).toContain('AutoCore');
  await ctx.dispose();
});

test('cart pricing validates and applies coupon limits', async () => {
  const ctx = await requestFactory.newContext();
  await login(ctx, 'customer@autoparts.local');
  await clearCart(ctx);
  const p = await firstAvailableProduct(ctx);
  await ctx.post(`${API}/cart/items`, { data: { productId: p.id, quantity: 5 } });
  const r = await ctx.post(`${API}/cart/coupon`, { data: { code: 'NYAR10' } });
  expect(r.ok(), await r.text()).toBeTruthy();
  const cart = await r.json();
  expect(cart.discountGross).toBeGreaterThan(0);
  expect(cart.totalGross).toBeLessThan(cart.subtotalGross + cart.shippingGross);
  await clearCart(ctx);
  await ctx.dispose();
});

test('admin can create a product and upload/attach an image', async () => {
  const ctx = await requestFactory.newContext();
  await login(ctx, 'admin@autoparts.local');
  const [manufacturers, categories] = await Promise.all([
    ctx.get(`${API}/admin/catalog/manufacturers`).then((r) => r.json()),
    ctx.get(`${API}/admin/catalog/categories`).then((r) => r.json()),
  ]);
  const stamp = Date.now();
  const created = await ctx.post(`${API}/products`, { data: {
    name: `E2E termék ${stamp}`, slug: `e2e-termek-${stamp}`, sku: `E2E-${stamp}`,
    shortDescription: 'E2E termék', description: 'Integrációs teszttermék', manufacturerId: manufacturers[0].id,
    netPrice: 1000, grossPrice: 1270, vatRate: 27, categoryIds: [categories[0].id], oemNumbers: [], alternativeNumbers: [],
  }});
  expect(created.ok(), await created.text()).toBeTruthy();
  const product = await created.json();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z7xkAAAAASUVORK5CYII=', 'base64');
  const upload = await ctx.post(`${API}/files/products`, { multipart: { file: { name: 'e2e.png', mimeType: 'image/png', buffer: png } } });
  expect(upload.ok(), await upload.text()).toBeTruthy();
  const uploaded = await upload.json();
  const attached = await ctx.post(`${API}/products/id/${product.id}/images`, { data: { url: uploaded.url, alt: 'E2E kép', isPrimary: true } });
  expect(attached.ok(), await attached.text()).toBeTruthy();
  await ctx.dispose();
});

test('concurrent checkout cannot over-reserve stock', async () => {
  const admin = await requestFactory.newContext();
  const customer = await requestFactory.newContext();
  const superadmin = await requestFactory.newContext();
  await login(admin, 'admin@autoparts.local');
  await login(customer, 'customer@autoparts.local');
  await login(superadmin, 'superadmin@autoparts.local');
  await clearCart(customer); await clearCart(superadmin);
  const balances = await (await admin.get(`${API}/inventory/balances`)).json();
  const grouped = new Map<string, number>();
  for (const b of balances) grouped.set(b.productId, (grouped.get(b.productId) ?? 0) + Math.max(0, b.physical - b.reserved - b.damaged));
  const candidate = [...grouped.entries()].find(([, n]) => n > 0 && n <= 30);
  expect(candidate).toBeTruthy();
  const [productId, available] = candidate!;
  await customer.post(`${API}/cart/items`, { data: { productId, quantity: available } });
  await superadmin.post(`${API}/cart/items`, { data: { productId, quantity: available } });
  const [a, b] = await Promise.all([
    customer.post(`${API}/orders/checkout`, { data: checkout('customer@autoparts.local') }),
    superadmin.post(`${API}/orders/checkout`, { data: checkout('superadmin@autoparts.local') }),
  ]);
  expect([a.ok(), b.ok()].filter(Boolean)).toHaveLength(1);
  await clearCart(customer); await clearCart(superadmin);
  await admin.dispose(); await customer.dispose(); await superadmin.dispose();
});

test('cancellation releases reservation and invalid state jumps are blocked', async () => {
  const admin = await requestFactory.newContext();
  const customer = await requestFactory.newContext();
  await login(admin, 'admin@autoparts.local'); await login(customer, 'customer@autoparts.local');
  await clearCart(customer);
  const p = await firstAvailableProduct(customer);
  const before = (await (await admin.get(`${API}/inventory/balances`)).json()).filter((x: { productId: string }) => x.productId === p.id);
  const reservedBefore = before.reduce((s: number, x: { reserved: number }) => s + x.reserved, 0);
  await customer.post(`${API}/cart/items`, { data: { productId: p.id, quantity: 1 } });
  const create = await customer.post(`${API}/orders/checkout`, { data: checkout('customer@autoparts.local') });
  expect(create.ok(), await create.text()).toBeTruthy();
  const order = await create.json();
  const invalid = await admin.patch(`${API}/orders/${order.id}/status`, { data: { status: 'COMPLETED' } });
  expect(invalid.status()).toBe(400);
  const cancelled = await admin.patch(`${API}/orders/${order.id}/status`, { data: { status: 'CANCELLED' } });
  expect(cancelled.ok(), await cancelled.text()).toBeTruthy();
  const after = (await (await admin.get(`${API}/inventory/balances`)).json()).filter((x: { productId: string }) => x.productId === p.id);
  expect(after.reduce((s: number, x: { reserved: number }) => s + x.reserved, 0)).toBe(reservedBefore);
  await admin.dispose(); await customer.dispose();
});

test('warehouse picking/packing converts reservation into physical sale', async () => {
  const admin = await requestFactory.newContext();
  const customer = await requestFactory.newContext();
  const warehouse = await requestFactory.newContext();
  await login(admin, 'admin@autoparts.local'); await login(customer, 'customer@autoparts.local'); await login(warehouse, 'warehouse@autoparts.local');
  await clearCart(customer);
  const p = await firstAvailableProduct(customer);
  const before = (await (await admin.get(`${API}/inventory/balances`)).json()).filter((x: { productId: string }) => x.productId === p.id);
  const physicalBefore = before.reduce((s: number, x: { physical: number }) => s + x.physical, 0);
  await customer.post(`${API}/cart/items`, { data: { productId: p.id, quantity: 1 } });
  const create = await customer.post(`${API}/orders/checkout`, { data: checkout('customer@autoparts.local') });
  const order = await create.json();
  expect((await warehouse.patch(`${API}/orders/${order.id}/status`, { data: { status: 'PICKING' } })).ok()).toBeTruthy();
  expect((await warehouse.patch(`${API}/orders/${order.id}/status`, { data: { status: 'PACKED' } })).ok()).toBeTruthy();
  const after = (await (await admin.get(`${API}/inventory/balances`)).json()).filter((x: { productId: string }) => x.productId === p.id);
  expect(after.reduce((s: number, x: { physical: number }) => s + x.physical, 0)).toBe(physicalBefore - 1);
  await admin.dispose(); await customer.dispose(); await warehouse.dispose();
});

test('signed payment webhook is idempotent', async () => {
  const customer = await requestFactory.newContext();
  await login(customer, 'customer@autoparts.local'); await clearCart(customer);
  const p = await firstAvailableProduct(customer);
  await customer.post(`${API}/cart/items`, { data: { productId: p.id, quantity: 1 } });
  const create = await customer.post(`${API}/orders/checkout`, { data: checkout('customer@autoparts.local', 'mock-card') });
  expect(create.ok(), await create.text()).toBeTruthy();
  const order = await create.json();
  const body = { eventId: `e2e-${Date.now()}`, orderId: order.id, status: 'paid' as const };
  const signature = createHmac('sha256', 'dev-webhook-secret').update(JSON.stringify(body)).digest('hex');
  const first = await customer.post(`${API}/payments/mock/webhook`, { data: body, headers: { 'x-signature': signature } });
  expect(first.ok(), await first.text()).toBeTruthy(); expect((await first.json()).idempotent).toBe(false);
  const second = await customer.post(`${API}/payments/mock/webhook`, { data: body, headers: { 'x-signature': signature } });
  expect(second.ok(), await second.text()).toBeTruthy(); expect((await second.json()).idempotent).toBe(true);
  await customer.dispose();
});
