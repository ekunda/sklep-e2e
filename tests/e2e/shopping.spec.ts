import { test, expect } from "./fixtures.js";

test.describe("Flow zakupowy (E2E)", () => {
  test("user dodaje produkt do koszyka i składa zamówienie", async ({
    authedPage,
    testProduct,
  }) => {
    const page = authedPage;

    await page.goto("/products.html");

    // Znajdź konkretny, zaseedowany produkt po data-testid.
    const card = page.getByTestId(`product-${testProduct.id}`);
    await expect(card).toBeVisible();

    // Dodaj do koszyka.
    await card.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await expect(page.getByTestId("toast")).toHaveText("Dodano do koszyka");
    await expect(page.getByTestId("cart-badge")).toHaveText("1");

    // Przejdź do koszyka.
    await page.getByRole("link", { name: "Koszyk" }).click();
    await expect(page).toHaveURL(/\/cart\.html/);
    await expect(page.getByText(testProduct.name)).toBeVisible();

    // Złóż zamówienie.
    await page.getByRole("button", { name: "Złóż zamówienie" }).click();

    // Potwierdzenie + pozycja na liście zamówień.
    await expect(page).toHaveURL(/\/orders\.html/);
    await expect(page.getByTestId("order-confirmation")).toBeVisible();
    await expect(page.locator('[data-testid^="order-row-"]')).toHaveCount(1);
  });

  test("nowy użytkownik nie ma jeszcze zamówień", async ({ authedPage }) => {
    await authedPage.goto("/orders.html");
    await expect(authedPage.getByTestId("empty-orders")).toHaveText("Brak zamówień");
  });

  test("nie można zamówić więcej niż jest na stanie", async ({ authedPage, request }) => {
    // Seed produktu z małym stanem magazynowym przez trasę testową.
    const res = await request.post("/api/test/seed-product", {
      data: { name: "Limitowany", price: 10, stock: 1 },
    });
    const product = await res.json();

    await authedPage.goto("/products.html");
    const card = authedPage.getByTestId(`product-${product.id}`);

    // Dodaj dwa razy (2 szt.), choć na stanie jest 1.
    await card.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await card.getByRole("button", { name: "Dodaj do koszyka" }).click();
    await expect(authedPage.getByTestId("cart-badge")).toHaveText("2");

    await authedPage.getByRole("link", { name: "Koszyk" }).click();
    await authedPage.getByRole("button", { name: "Złóż zamówienie" }).click();

    // Backend odrzuca — zostajemy w koszyku, leci toast z błędem o stanie.
    await expect(authedPage.getByTestId("toast")).toContainText("stock");
    await expect(authedPage).toHaveURL(/\/cart\.html/);

    // sprzątanie produktu
    await request.delete(`/api/test/cleanup-product/${product.id}`);
  });
});
