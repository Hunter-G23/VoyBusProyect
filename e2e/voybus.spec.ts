import { test, expect, type Page } from "@playwright/test";
async function login(page: Page, email: string) {
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("VoyBusDemo2026!");
  await page
    .getByRole("button", { name: "Ingresar", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Salir", exact: true }),
  ).toBeVisible();
}
test("nueve requisitos integrados, persistencia y errores recuperables", async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByText("Encuentra tu recorrido")).toBeVisible();
  await expect(page.getByText("Tu sesión venció.")).toHaveCount(0);
  await page.getByRole("button", { name: "L01, Centro y terminal" }).click();
  await page.getByRole("button").filter({ hasText: "Ida" }).click();
  await expect(page.getByText("P01 · -23.65000, -70.40000")).toBeVisible();
  await expect(page.getByText("P03 · -23.63000, -70.38000")).toBeVisible();
  await page.getByRole("button", { name: "Ir a mi viaje" }).click();
  await page.getByRole("button", { name: "Ingresar o crear cuenta" }).click();
  await page
    .getByRole("button", { name: "Crear una cuenta", exact: true })
    .click();
  const email = `integrado-${testInfo.project.name}-${Date.now()}@example.test`;
  await page.getByLabel("Nombre", { exact: true }).fill("Pasajero Integrado");
  await page.getByLabel("Correo electrónico", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("VoyBusDemo2026!");
  await page.getByLabel("Confirmar contraseña").fill("distinta");
  await page.getByRole("button", { name: "Crear cuenta de pasajero" }).click();
  await expect(
    page.getByText("Las contraseñas deben coincidir."),
  ).toBeVisible();
  await page.getByLabel("Confirmar contraseña").fill("VoyBusDemo2026!");
  await page.getByRole("button", { name: "Crear cuenta de pasajero" }).click();
  await expect(
    page.getByText(
      "Tu cuenta está creada. Ingresa con tu correo y contraseña.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ingresar", exact: true })
    .last()
    .click();
  await expect(page.getByText("Vincula tu vehículo")).toBeVisible();
  await page.getByLabel("Código del vehículo").fill("BUS999");
  await page.getByRole("button", { name: "Vincular vehículo" }).click();
  await expect(
    page.getByText("No encontramos un servicio activo para ese código."),
  ).toBeVisible();
  await page.getByLabel("Código del vehículo").fill("BUS001");
  await page.getByRole("button", { name: "Vincular vehículo" }).click();
  await expect(
    page.getByRole("radio", { name: "P01, Inicio, ya pasó" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: "P03, Terminal" }).click();
  // Lose a server response after it has committed. Retry must recover one receipt.
  let receiptId: number | undefined;
  await page.route(
    "**/api/viaje/solicitudes",
    async (route) => {
      const response = await route.fetch();
      receiptId = (await response.json()).solicitud.id;
      await route.abort("failed");
    },
    { times: 1 },
  );
  await page
    .getByRole("button", { name: "Solicitar parada en Terminal" })
    .click();
  await expect(
    page.getByText("Hay un envío sin confirmar.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reintentar envío" }).click();
  await expect(
    page.getByText("Solicitud enviada", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`Solicitud #${receiptId}`, { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("pasajero.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("tab", { name: "Mi viaje" }).click();
  await expect(
    page.getByText(`Solicitud #${receiptId}`, { exact: false }),
  ).toBeVisible();
  await page.route("**/api/viaje/solicitudes/*", (route) => route.abort());
  await page.getByRole("button", { name: "Actualizar seguimiento" }).click();
  await expect(
    page.getByText("Información sin actualizar.", { exact: false }),
  ).toBeVisible();
  await page.unroute("**/api/viaje/solicitudes/*");
  await page.getByRole("button", { name: "Actualizar seguimiento" }).click();
  await expect(
    page.getByText("Información sin actualizar.", { exact: false }),
  ).toHaveCount(0);
  const driverContext = await browser.newContext({
    viewport:
      testInfo.project.name === "mobile-web"
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
  });
  const driver = await driverContext.newPage();
  await driver.goto("http://localhost:8082");
  await login(driver, "conductor@example.test");
  await expect(
    driver.getByText("Solicitudes de parada", { exact: true }),
  ).toBeVisible();
  await expect(
    driver.getByText(`#${receiptId}`, { exact: true }),
  ).toBeVisible();
  await driver.screenshot({
    path: testInfo.outputPath("conductor.png"),
    fullPage: true,
  });
  await driverContext.close();
  expect(errors).toEqual([]);
});
