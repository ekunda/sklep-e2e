import { test as base, expect, type Page } from "@playwright/test";

export interface TestUser {
  id: number;
  email: string;
  password: string;
  token: string;
}

export interface TestProduct {
  id: number;
  name: string;
  price: string;
  stock: number;
}

interface Fixtures {
  testUser: TestUser;
  testProduct: TestProduct;
  authedPage: Page;
}

/**
 * Rozszerzamy bazowy `test` o własne fixtures.
 *
 * Wzorzec "seed per test": każdy test, który poprosi o `testUser`/`testProduct`,
 * dostaje świeże, unikalne dane utworzone przez trasy /api/test/* PRZED testem,
 * a po teście fixture je sprząta (teardown po `await use(...)`).
 */
export const test = base.extend<Fixtures>({
  testUser: async ({ request }, use) => {
    // Unikalny email — żeby równoległe testy się nie zderzyły.
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
    const password = "E2EPass123!";

    const res = await request.post("/api/test/seed-user", {
      data: { email, password, name: "E2E User" },
    });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    await use({ id: data.id, email, password, token: data.token });

    // Teardown — usuń użytkownika (CASCADE skasuje też jego zamówienia).
    await request.delete(`/api/test/cleanup-user/${data.id}`);
  },

  testProduct: async ({ request }, use) => {
    const res = await request.post("/api/test/seed-product", {
      data: { name: "Produkt E2E", price: 49.99, stock: 100 },
    });
    expect(res.ok()).toBeTruthy();
    const product = (await res.json()) as TestProduct;

    await use(product);

    await request.delete(`/api/test/cleanup-product/${product.id}`);
  },

  // Strona z już "zalogowanym" użytkownikiem — token w localStorage,
  // bez przechodzenia przez formularz (dużo szybciej niż logowanie po UI).
  authedPage: async ({ page, testUser }, use) => {
    await page.goto("/"); // ustanawiamy origin, żeby localStorage był dostępny
    await page.evaluate((token) => {
      localStorage.setItem("auth_token", token);
    }, testUser.token);

    await use(page);
  },
});

export { expect };
