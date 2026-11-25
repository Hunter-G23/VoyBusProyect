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

test("a route stop opens the map at its network stop ID without drawing a route", async ({ page }) => {
  const line = { id: 93, codigo: "930", nombre: "Línea de prueba", estado: "activa" };
  const route = { id: 307, nombre: "Puerto a Terminal", origen: "Puerto", destino: "Terminal", sentido: "Ida" };
  const stop = { id: 71, codigo: "P071", nombre: "Plaza Puerto", latitud: -23.631, longitud: -70.397, lineas: [line] };
  await page.route(/\/api\/red\/lineas\?todas=1$/, request => request.fulfill({ json: { lineas: [line] } }));
  await page.route("**/api/red/lineas/93/recorridos", request => request.fulfill({ json: { recorridos: [route] } }));
  await page.route("**/api/red/recorridos/307/paraderos", request => request.fulfill({ json: {
    paraderos: [{ ...stop, id: 708, paradero_id: stop.id, posicion: 1 }],
  } }));
  await page.route("**/api/red/mapa", request => request.fulfill({ json: {
    version: "test", fuente: "test", lineas: [line], paraderos: [stop],
    recorridos: [{ ...route, linea_id: line.id, linea: line.codigo, codigo: line.codigo, variante: false,
      geometria: { type: "LineString", coordinates: [[-70.397, -23.631], [-70.396, -23.627]] },
      paraderos: [{ paradero_id: stop.id, posicion: 1, distancia_m: 100 }] }],
  } }));
  await page.route("**/api/red/paraderos/71/llegadas", request => request.fulfill({ json: {
    paradero: stop, generado_en: new Date().toISOString(), fuente: "gps", llegadas: [],
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: /^930,/ }).click();
  await page.getByRole("radio").first().click();
  const arrivalRequest = page.waitForRequest("**/api/red/paraderos/71/llegadas");
  await page.getByRole("button", { name: "Ver Plaza Puerto (P071) en el mapa" }).click();
  await arrivalRequest;
  await expect(page.getByRole("tab", { name: "Mapa", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Plaza Puerto", exact: true })).toBeVisible();
  const map = page.locator('.voybus-map[data-map-loaded="true"]');
  await expect(map).toHaveAttribute("data-map-focused-stop", String(stop.id), { timeout: 25000 });
  await expect(map).not.toHaveAttribute("data-map-route-id", /\d/);
});

test("line search and filters combine the three service states", async ({ page }) => {
  await page.route(/\/api\/red\/lineas\?todas=1$/, (route) => route.fulfill({ json: {
    lineas: [
      { id: 102, codigo: "102", nombre: "Centro a Estación", estado: "activa" },
      { id: 103, codigo: "103", nombre: "Terminal a Barrio Norte", estado: "inactiva" },
      { id: 201, codigo: "E01", nombre: "Centro a Universidad", estado: "temporal", electrica: true },
    ],
  } }));
  await page.goto("/");
  const active = page.getByRole("button", { name: /^102,/ });
  const inactive = page.getByRole("button", { name: /^103,/ });
  const temporary = page.getByRole("button", { name: /^E01,/ });
  await expect(active).toContainText("Activa");
  await expect(inactive).toContainText("No activa");
  await expect(temporary).toContainText("Temporalmente inactiva");
  await expect(temporary).toContainText("Eléctrica");
  const filters = page.getByRole("radiogroup", { name: "Estado de líneas" });
  await filters.getByRole("radio", { name: "No activas" }).click();
  await expect(inactive).toBeVisible();
  await expect(active).toHaveCount(0);
  await expect(temporary).toHaveCount(0);
  await filters.getByRole("radio", { name: "Activas", exact: true }).click();
  await expect(active).toBeVisible();
  await expect(inactive).toHaveCount(0);
  const search = page.getByRole("searchbox", { name: "Número o destino" });
  await search.fill("estacion");
  await expect(active).toBeVisible();
  await expect(page.getByText("1 línea", { exact: true })).toBeVisible();
  await filters.getByRole("radio", { name: "Temporalmente inactivas" }).click();
  await expect(page.getByRole("heading", { name: "Sin líneas para esta selección" })).toBeVisible();
  await search.fill("e01");
  await expect(temporary).toBeVisible();
  await expect(active).toHaveCount(0);
  await expect(inactive).toHaveCount(0);
});

test("captures the line directory in mobile, dark and landscape layouts", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^102,/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("lineas-375.png") });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.getByRole("button", { name: /^102,/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("lineas-375-oscuro.png") });
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 812, height: 375 });
  await page.reload();
  await expect(page.getByRole("button", { name: /^102,/ })).toBeVisible();
  await page.screenshot({ path: info.outputPath("lineas-horizontal.png") });
});
