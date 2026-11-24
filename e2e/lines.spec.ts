import { expect, test } from "@playwright/test";

test("official lines, electric label, readable status and ordered stops", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Líneas", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^E01,/ })).toContainText("Eléctrica");
  await expect(page.getByText("Activa", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /^102,/ }).click();
  await expect(page.getByRole("radiogroup", { name: "Recorridos" })).toBeVisible();
  await page.getByRole("radio").first().click();
  const stops = page.getByTestId("ordered-stops");
  await expect(stops).toBeVisible();
  const positions = await stops.getByTestId("stop-position").allTextContents();
  expect(positions.length).toBeGreaterThan(2);
  expect(positions.map(Number)).toEqual([...positions.map(Number)].sort((a, b) => a - b));
  await expect(page.getByRole("button", { name: "Ir a mi viaje" })).toBeVisible();
});
