import { test, expect } from "./fixtures.js";

test.describe("Logowanie (UI)", () => {
  test("poprawne dane przekierowują na listę produktów", async ({ page, testUser }) => {
    await page.goto("/login.html");

    // Selektory po etykietach i roli — stabilne i czytelne (jak w szkoleniu).
    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Hasło").fill(testUser.password);
    await page.getByRole("button", { name: "Zaloguj się" }).click();

    await expect(page).toHaveURL(/\/products\.html/);
    await expect(page.getByRole("heading", { name: "Produkty" })).toBeVisible();
  });

  test("złe hasło pokazuje komunikat błędu i zostaje na stronie logowania", async ({
    page,
    testUser,
  }) => {
    await page.goto("/login.html");

    await page.getByLabel("Email").fill(testUser.email);
    await page.getByLabel("Hasło").fill("zupelnie-zle-haslo");
    await page.getByRole("button", { name: "Zaloguj się" }).click();

    await expect(page.getByTestId("login-error")).toHaveText("Nieprawidłowy email lub hasło");
    await expect(page).toHaveURL(/\/login\.html/);
  });
});
