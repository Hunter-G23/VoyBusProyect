import { test, expect } from "@playwright/test";
test("map renders canvas and an accessible vehicle list", async ({ page }) => {
  const diagnostics: string[] = [];
  page.on("requestfailed", request => diagnostics.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("console", message => { if (message.type() === "error") diagnostics.push(message.text()); });
  await page.goto("/");
  await page.getByRole("tab", { name: "Mapa", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Posiciones por vehículo" })).toBeVisible();
  await expect(page.getByText("BUS001 · Línea 102", { exact: true })).toBeVisible();
  await expect(page.getByText(/Actualizada|Desactualizada|Sin datos de posición/).first()).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 20000 });
  try { await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25000 }); }
  catch (error) { console.error(diagnostics.join("\n")); throw error; }
  await expect(page.getByText(/No pudimos cargar el mapa/)).toHaveCount(0);
});
