const run = process.env.RUN_HTTP_INTEGRATION === '1' ? describe : describe.skip;
const API = process.env.INTEGRATION_API_URL ?? 'http://localhost:4000/api';

run('AutoParts Pro HTTP integration', () => {
  it('reports healthy database-backed API', async () => {
    const response = await fetch(`${API}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('serves seeded products and protects admin writes', async () => {
    const products = await fetch(`${API}/products?limit=2`);
    expect(products.status).toBe(200);
    const body = await products.json() as { items: unknown[] };
    expect(body.items.length).toBeGreaterThan(0);
    const denied = await fetch(`${API}/products`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(denied.status).toBe(401);
  });
});
