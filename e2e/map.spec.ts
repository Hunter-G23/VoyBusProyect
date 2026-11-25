import { test, expect } from "@playwright/test";
import { applyMapPalette, mapPalette, type MapLayerLike } from "../front/src/mapStyle";

function contrastRatio(hexA: string, hexB: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5]
      .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((a, b) => b - a);
  return (hi! + 0.05) / (lo! + 0.05);
}

test("dark map palette sets high-contrast symbol labels and soft buildings", () => {
  const layers: MapLayerLike[] = [
    { id: "background", type: "background" },
    { id: "building", type: "fill", "source-layer": "building" },
    { id: "road_label", type: "symbol", layout: { "text-field": "{name}" } },
    { id: "place_city", type: "symbol", layout: { "text-field": "{name}" } },
  ];
  const applied = new Map<string, Record<string, unknown>>();
  const fakeMap = {
    getStyle: () => ({ layers }),
    setPaintProperty: (layerId: string, name: string, value: unknown) => {
      applied.set(layerId, { ...(applied.get(layerId) ?? {}), [name]: value });
    },
  };

  applyMapPalette(fakeMap, "dark");
  const darkPalette = mapPalette("dark");
  const roadLabel = applied.get("road_label");
  const cityLabel = applied.get("place_city");
  expect(roadLabel?.["text-color"]).toBe(darkPalette.text);
  expect(roadLabel?.["text-halo-color"]).toBe(darkPalette.textHalo);
  expect(cityLabel?.["text-color"]).toBe(darkPalette.text);
  expect(applied.get("building")?.["fill-color"]).toBe(darkPalette.building);
  expect(contrastRatio(String(roadLabel?.["text-color"]), darkPalette.land)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(String(roadLabel?.["text-color"]), String(roadLabel?.["text-halo-color"]))).toBeGreaterThanOrEqual(4.5);
});

test("map renders canvas and an accessible vehicle list", async ({ page }) => {
  const diagnostics: string[] = [];
  page.on("requestfailed", request => diagnostics.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on("console", message => { if (message.type() === "error") diagnostics.push(message.text()); });
  await page.goto("/");
  await page.getByRole("tab", { name: "Mapa", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Posiciones por micro" })).toBeVisible();
  await expect(page.getByText("BUS001 · Línea 102", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Actualizada|Desactualizada|Sin datos de posición/).first()).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible({ timeout: 20000 });
  try { await expect(page.locator('.voybus-map[data-map-loaded="true"]')).toBeVisible({ timeout: 25000 }); }
  catch (error) { console.error(diagnostics.join("\n")); throw error; }
  await expect(page.getByText(/No pudimos cargar el mapa/)).toHaveCount(0);
});

test("map shows compact buses with their line colors, electric badge, and selection", async ({ page }, info) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: "light" });
  const measured = new Date().toISOString();
  const cors = {
    "access-control-allow-origin": "http://localhost:8082",
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
  await page.route("**/api/red/mapa", route => route.fulfill({
    headers: cors,
    json: { version: "test", fuente: "test", recorridos: [], paraderos: [], lineas: [
      { id: 1, codigo: "E01", nombre: "Línea E01", color: "#598200", color_texto: "#FFFFFF", electrica: 1, estado: "activa" },
      { id: 2, codigo: "102", nombre: "Línea 102", color: "#005BAA", color_texto: "#FFFFFF", electrica: 0, estado: "activa" },
    ] },
  }));
  await page.route("**/api/red/vehiculos", route => route.fulfill({
    headers: cors,
    json: { fuente: "simulacion", generado_en: measured, vehiculos: [
      { servicio_id: 1, vehiculo: "BUS_E01", linea: "E01", recorrido_id: 1, sentido: "Ida",
        posicion: { latitud: -23.631, longitud: -70.397, medida_en: measured, desactualizada: false } },
      { servicio_id: 2, vehiculo: "BUS102", linea: "102", recorrido_id: 2, sentido: "Ida",
        posicion: { latitud: -23.652, longitud: -70.398, medida_en: new Date(Date.now() - 60000).toISOString(), desactualizada: true } },
      { servicio_id: 3, vehiculo: "BUS999", linea: "102", recorrido_id: 2, sentido: "Ida",
        posicion: { latitud: 91, longitud: -70.398, medida_en: measured, desactualizada: false } },
    ] },
  }));
  await page.goto("/");
  await page.getByRole("tab", { name: "Mapa", exact: true }).click();
  const map = page.locator(".voybus-map[data-map-loaded]");
  await expect(map.locator(".voybus-marker")).toHaveCount(2);
  await expect(map.locator('.voybus-marker[aria-pressed="true"]')).toHaveCount(0);
  const electric = map.getByRole("button", { name: /BUS_E01 · Línea E01.*Línea eléctrica/ });
  const conventional = map.getByRole("button", { name: /BUS102 · Línea 102.*Desactualizada/ });
  for (const [marker, code, color] of [[electric, "E01", "rgb(89, 130, 0)"], [conventional, "102", "rgb(0, 91, 170)"]] as const) {
    await expect(marker).toBeVisible();
    await expect(marker).toHaveCSS("position", "absolute");
    const box = (await marker.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(47.9); // sub-pixel rounding
    expect(box.width).toBeLessThan(64);
    expect(box.height).toBeGreaterThanOrEqual(47.9);
    expect(box.height).toBeLessThan(64);
    await expect(marker).toHaveAttribute("aria-label", new RegExp(`Línea ${code}`));
    const point = (await marker.locator(".voybus-marker-point").boundingBox())!;
    const bus = (await marker.locator(".voybus-marker-body").boundingBox())!;
    expect(point.width).toBeLessThanOrEqual(12);
    expect(point.height).toBeLessThanOrEqual(12);
    expect(Math.abs(point.x + point.width / 2 - box.x - box.width / 2)).toBeLessThan(0.5);
    expect(Math.abs(point.y + point.height / 2 - box.y - box.height / 2)).toBeLessThan(0.5);
    expect(bus.width).toBeLessThanOrEqual(18);
    expect(bus.height).toBeLessThanOrEqual(20);
    expect(bus.x).toBeGreaterThan(point.x + point.width / 2);
    expect(bus.y + bus.height / 2).toBeLessThan(point.y + point.height / 2);
    await expect(marker.locator(".voybus-marker-body")).toHaveCSS("fill", color);
  }
  await expect(electric.locator(".voybus-marker-electric path")).toBeVisible();
  await expect(conventional.locator(".voybus-marker-electric")).toHaveCount(0);
  await expect(conventional.locator(".voybus-marker-body")).toHaveAttribute("stroke-dasharray", "3 2");

  await expect(map).toHaveAttribute("data-map-loaded", "true", { timeout: 25000 });
  const attrib = map.locator(".maplibregl-ctrl-attrib");
  await expect(attrib).not.toHaveClass(/maplibregl-compact-show/);
  const attribBtn = map.locator(".maplibregl-ctrl-attrib-button");
  const attribBox = (await attribBtn.boundingBox())!;
  expect(attribBox.width).toBeGreaterThanOrEqual(48);
  expect(attribBox.height).toBeGreaterThanOrEqual(48);

  await expect(page.getByRole("heading", { name: "2 micros en circulación" })).toBeVisible();
  // At the opening zoom (13) buses are colour dots without touch targets; keyboard selection still works.
  await expect(map).toHaveAttribute("data-zoom-band", "mid");
  await conventional.focus();
  await page.keyboard.press("Enter");
  await expect(conventional).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("BUS102 · Línea 102", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("mapa-claro-375x812.png"), animations: "disabled" });

  await Promise.all([
    page.waitForRequest("https://tiles.openfreemap.org/styles/dark"),
    page.emulateMedia({ colorScheme: "dark" }),
  ]);
  await expect(map).toHaveAttribute("data-map-loaded", "true", { timeout: 25000 });
  await expect(attrib).not.toHaveClass(/maplibregl-compact-show/);
  await expect(page.getByText("BUS102 · Línea 102", { exact: true })).toBeVisible();
  await expect(conventional).toHaveAttribute("aria-pressed", "true");
  // A selected bus is shown alone with its route.
  await expect(electric).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("mapa-oscuro-375x812.png"), animations: "disabled" });
});

test("map filters by future service ID and draws only the selected vehicle route", async ({ page }) => {
  const measured = new Date().toISOString();
  const line = { id: 1, codigo: "102", nombre: "Línea 102", color: "#005BAA" };
  const stop = { id: 91, codigo: "P091", nombre: "Estación Puerto", latitud: -23.631, longitud: -70.397, lineas: [line] };
  const nextStop = { ...stop, id: 92, codigo: "P092", nombre: "Terminal Norte", latitud: -23.635 };
  const outbound = {
    id: 21, linea_id: 1, linea: "102", codigo: "102", nombre: "Puerto a Terminal",
    origen: "Puerto", destino: "Terminal", sentido: "Ida", variante: false,
    geometria: { type: "LineString", coordinates: [[-70.397, -23.635], [-70.397, -23.631]] },
    paraderos: [{ paradero_id: stop.id, posicion: 1, distancia_m: 100 }],
  };
  const inbound = { ...outbound, id: 22, sentido: "Vuelta", paraderos: [{ paradero_id: nextStop.id, posicion: 1, distancia_m: 100 }] };
  const position = { latitud: -23.631, longitud: -70.397, medida_en: measured, desactualizada: false };
  const upcoming = { servicio_id: -1, vehiculo: "SIM-102", linea: "102", recorrido_id: 21, sentido: "Ida", posicion: position, simulado: true };
  const expired = { ...upcoming, servicio_id: 2, vehiculo: "BUS-PASADO", simulado: false,
    posicion: { ...position, latitud: -23.635 } };
  const opposite = { ...expired, servicio_id: 3, vehiculo: "BUS-VUELTA", recorrido_id: 22, sentido: "Vuelta",
    proximo_paradero_id: nextStop.id, posicion: { ...position, latitud: -23.627 } };
  const arrival = {
    servicio_id: upcoming.servicio_id, vehiculo: upcoming.vehiculo, linea: "102", linea_id: 1, recorrido_id: outbound.id,
    sentido: "Ida", destino: "Terminal", minutos: 3, segundos: 180, distancia_m: 1000, origen: "simulacion",
  };

  await page.route("**/api/red/mapa", route => route.fulfill({ json: {
    version: "test", fuente: "test", lineas: [line], recorridos: [outbound, inbound], paraderos: [stop, nextStop],
  } }));
  await page.route("**/api/red/vehiculos", route => route.fulfill({ json: {
    fuente: "gps", generado_en: measured, vehiculos: [upcoming, expired, opposite],
  } }));
  let polls = 0;
  await page.route("**/api/red/paraderos/91/llegadas", route => {
    polls++;
    return route.fulfill({ json: {
      paradero: stop, generado_en: measured, fuente: "mixta",
      llegadas: [{ ...arrival, minutos: polls === 1 ? 3 : 2 }, { ...arrival, servicio_id: expired.servicio_id, segundos: -20 }],
    } });
  });
  await page.route("**/api/red/paraderos/92/llegadas", route => route.fulfill({ json: {
    paradero: nextStop, generado_en: measured, fuente: "gps", llegadas: [{
      ...arrival, servicio_id: opposite.servicio_id, vehiculo: opposite.vehiculo, sentido: opposite.sentido,
      recorrido_id: inbound.id, minutos: 4, origen: "estimacion",
    }],
  } }));
  await page.goto("/");
  await page.getByRole("tab", { name: "Mapa", exact: true }).click();

  const map = page.locator('.voybus-map[data-map-loaded="true"]');
  const markers = map.locator(".voybus-marker");
  await expect(markers).toHaveCount(3, { timeout: 25000 });
  await expect(map).not.toHaveAttribute("data-map-route-id", /\d/);
  await expect(map.locator('[aria-pressed="true"].voybus-marker')).toHaveCount(0);

  await page.getByRole("button", { name: "Buscar paradero" }).click();
  await page.getByRole("searchbox", { name: "Nombre o código del paradero" }).fill("estacion");
  await page.getByRole("button", { name: "Seleccionar Estación Puerto, P091" }).click();
  await expect(page.getByRole("heading", { name: stop.nombre })).toBeVisible();
  await expect(map).toHaveAttribute("data-map-focused-stop", String(stop.id));
  await expect(map).not.toHaveAttribute("data-map-route-id", /\d/);
  await expect(markers).toHaveCount(1);
  await expect(markers.first()).toHaveAttribute("aria-label", /SIM-102/);
  await expect(page.getByText("2 min simulados", { exact: true })).toBeVisible({ timeout: 10000 });

  // Upcoming arrivals are tappable rows that select the bus.
  await page.getByRole("button", { name: "Seleccionar SIM-102, línea 102" }).click();
  await expect(page.getByRole("heading", { name: "SIM-102 · Línea 102" })).toBeVisible();
  await expect(map).toHaveAttribute("data-map-route-id", String(outbound.id));
  await expect(markers).toHaveCount(1);
  await expect(markers.first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Paradero de referencia · Estación Puerto", { exact: true })).toBeVisible();
  // A selected bus shows only itself and its route: no line filter.
  await expect(page.getByRole("radiogroup", { name: "Filtrar por línea" })).toHaveCount(0);

  // Coming from a stop, the close button returns to that stop.
  await page.getByRole("button", { name: "Volver al paradero" }).click();
  await expect(page.getByRole("heading", { name: stop.nombre })).toBeVisible();
  await expect(map).not.toHaveAttribute("data-map-route-id", /\d/);
  await page.getByRole("button", { name: "Ver toda la flota" }).click();
  await expect(markers).toHaveCount(3);
  await expect(map).not.toHaveAttribute("data-map-route-id", /\d/);
  await page.getByRole("button", { name: "Seleccionar BUS-VUELTA, línea 102" }).click();
  await expect(map).toHaveAttribute("data-map-route-id", String(inbound.id));
  await expect(page.getByText("Paradero de referencia · Terminal Norte", { exact: true })).toBeVisible();
  await expect(page.getByText("4 min aprox.", { exact: true })).toBeVisible();
});

test("map stays usable in 812x375 landscape without overflow", async ({ page }, info) => {
  await page.setViewportSize({ width: 812, height: 375 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("tab", { name: "Mapa", exact: true }).click();
  const map = page.locator('.voybus-map[data-map-loaded="true"]');
  await expect(map).toBeVisible({ timeout: 25000 });
  const canvasBox = (await map.locator("canvas").boundingBox())!;
  expect(canvasBox.height).toBeGreaterThanOrEqual(120);
  const overflow = await page.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.width);
  await expect(page.getByRole("heading", { name: "Posiciones por micro" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("mapa-landscape-812x375.png"), animations: "disabled" });
});

// MapLibre keyboard zoom: "=" zooms in and "-" zooms out by one level.
async function zoomBy(map: import("@playwright/test").Locator, levels: number) {
  await map.locator("canvas").focus();
  for (let i = 0; i < Math.abs(levels); i++) {
    await map.page().keyboard.press(levels > 0 ? "Equal" : "Minus");
    await map.page().waitForTimeout(400);
  }
}

test("buses appear by zoom band with fade and stay visible when a line filter pins them", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const measured = new Date().toISOString();
  const lines = [
    { id: 1, codigo: "102", nombre: "Línea 102", color: "#005BAA", color_texto: "#FFFFFF", electrica: 0, estado: "activa" },
    { id: 2, codigo: "E01", nombre: "Línea E01", color: "#598200", color_texto: "#FFFFFF", electrica: 1, estado: "activa" },
  ];
  await page.route("**/api/red/mapa", route => route.fulfill({ json: { version: "test", fuente: "test", recorridos: [], paraderos: [], lineas: lines } }));
  await page.route("**/api/red/vehiculos", route => route.fulfill({ json: { fuente: "simulacion", generado_en: measured, vehiculos: [
    { servicio_id: 1, vehiculo: "BUS102", linea: "102", recorrido_id: 1, sentido: "Ida",
      posicion: { latitud: -23.641, longitud: -70.391, medida_en: measured, desactualizada: false } },
    { servicio_id: 2, vehiculo: "BUSE01", linea: "E01", recorrido_id: 2, sentido: "Ida",
      posicion: { latitud: -23.639, longitud: -70.389, medida_en: measured, desactualizada: false } },
  ] } }));
  await page.goto("/");
  await page.getByRole("tab", { name: "Mapa", exact: true }).click();
  const map = page.locator('.voybus-map[data-map-loaded="true"]');
  const bus = map.locator(".voybus-marker").filter({ has: page.locator(".voybus-marker-body") });
  await expect(bus).toHaveCount(2, { timeout: 25000 });
  const style = (property: string) => bus.first().evaluate((element, property) =>
    getComputedStyle(element).getPropertyValue(property), property);
  const busPart = () => bus.first().locator(".voybus-marker-bus").evaluate(element => getComputedStyle(element).opacity);

  await expect(map).toHaveAttribute("data-zoom-band", "mid");
  await expect.poll(() => style("pointer-events")).toBe("none");
  await expect.poll(busPart).toBe("0");
  expect(await style("transition-duration")).toContain("0.2s");

  await zoomBy(map, -1);
  await expect(map).toHaveAttribute("data-zoom-band", "far");
  await expect.poll(() => style("visibility")).toBe("hidden");
  await expect(page.getByText("Acércate en el mapa para ver las micros.")).toBeVisible();

  await page.getByRole("radio", { name: "Línea 102", exact: true }).click();
  await expect(bus).toHaveCount(1);
  await expect(bus.first()).toHaveAttribute("data-pinned", "true");
  await expect.poll(() => style("visibility")).toBe("visible");
  await expect(page.getByText("Solo línea 102")).toBeVisible();
  await page.getByRole("radio", { name: "Todas", exact: true }).click();
  await expect(bus).toHaveCount(2);

  await zoomBy(map, 2);
  await expect(map).toHaveAttribute("data-zoom-band", "near");
  await expect.poll(() => style("pointer-events")).toBe("auto");
  await expect.poll(busPart).toBe("1");
});

test("bottom sheet follows a drag, settles on the nearest height and keeps its handle reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Mapa", exact: true }).click();
  const last = page.getByRole("button", { name: /^Seleccionar SIM-/ }).last();
  await expect(last).toBeAttached({ timeout: 25000 });
  const handle = page.getByRole("button", { name: "Contraer panel", exact: true });
  const top = async () => (await page.getByRole("button", { name: /panel$/ }).boundingBox())!.y;
  const half = await top();
  expect(half).toBeGreaterThan(844 * 0.35);

  // Drag up past the midpoint: settles fully open; the list end is reachable with the handle still on screen.
  const title = (await page.getByRole("heading", { name: /micros en circulación/ }).boundingBox())!;
  await page.mouse.move(195, title.y + 10); await page.mouse.down();
  await page.mouse.move(195, title.y - 250, { steps: 10 });
  expect(await top()).toBeLessThan(half - 100); // follows the pointer before release
  await page.mouse.up();
  await expect.poll(top).toBeLessThan(844 * 0.25);
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeInViewport();
  await expect(handle).toBeInViewport();

  // Tap the handle: collapses to the header only and hides the list from assistive tech.
  await handle.click();
  const expand = page.getByRole("button", { name: "Expandir panel", exact: true });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect.poll(top).toBeGreaterThan(844 * 0.6);
  await expect(last).not.toBeInViewport();
  await expand.click();
  await expect.poll(top).toBeLessThan(844 * 0.6);
});
