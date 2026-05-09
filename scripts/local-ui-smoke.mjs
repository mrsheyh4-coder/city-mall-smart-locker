import { chromium } from 'playwright';

const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertStyled(page, label) {
  const state = await page.locator('main').evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      color: style.color,
      background: style.backgroundImage,
      bodyBg: window.getComputedStyle(document.body).backgroundColor,
    };
  });

  assert(
    state.background.includes('gradient') || state.bodyBg !== 'rgba(0, 0, 0, 0)',
    `${label}: CSS is not applied`,
  );
}

async function clickUnique(page, role, name) {
  const locator = page.getByRole(role, { name, exact: true });
  const count = await locator.count();
  assert(count === 1, `Expected one ${role} "${name}", found ${count}`);
  await locator.click();
}

async function fillBySelector(page, selector, value) {
  const locator = page.locator(selector);
  const count = await locator.count();
  assert(count === 1, `Expected one field "${selector}", found ${count}`);
  await locator.fill(value);
}

async function testTerminal(page) {
  await page.goto(`${frontendUrl}/terminal`, { waitUntil: 'networkidle' });
  await assertStyled(page, 'Terminal language page');
  await page.getByRole('heading', { name: 'Tilni tanlang' }).waitFor();

  await clickUnique(page, 'button', "O'zbek");
  await page.getByRole('heading', { name: 'Yashik hajmini tanlang' }).waitFor();
  await clickUnique(page, 'button', 'Ortga');
  await page.getByRole('heading', { name: 'Tilni tanlang' }).waitFor();

  await clickUnique(page, 'button', "O'zbek");
  await page.getByRole('heading', { name: 'Yashik hajmini tanlang' }).waitFor();
  await page.getByRole('button', { name: /Kichik/ }).click();
  await page.getByRole('heading', { name: 'Saqlash muddatini tanlang' }).waitFor();
  await clickUnique(page, 'button', 'Ortga');
  await page.getByRole('heading', { name: 'Yashik hajmini tanlang' }).waitFor();

  await page.getByRole('button', { name: /O'rta/ }).click();
  await page.getByRole('heading', { name: 'Saqlash muddatini tanlang' }).waitFor();
  await page.getByRole('button', { name: /15 daqiqa/ }).click();
  await page.getByRole('heading', { name: 'Telefon raqamingiz' }).waitFor();
  await fillBySelector(page, 'input[inputmode="tel"]', '+998901234567');
  await clickUnique(page, 'button', 'SMS kod yuborish');
  await page.getByRole('heading', { name: 'SMS kodni kiriting' }).waitFor();
  const codeText = await page.getByText(/Demo kod:/).innerText();
  const code = codeText.replace(/\D/g, '').slice(-4);
  assert(code.length === 4, 'Demo SMS code was not shown');
  await fillBySelector(page, 'input[inputmode="numeric"][maxlength="4"]', code);
  await clickUnique(page, 'button', 'Tasdiqlash');
  await page.getByRole('heading', { name: 'Saqlash shartlari' }).waitFor();
  await clickUnique(page, 'button', 'Ortga');
  await page.getByRole('heading', { name: 'SMS kodni kiriting' }).waitFor();
  await clickUnique(page, 'button', 'Ortga');
  await page.getByRole('heading', { name: 'Telefon raqamingiz' }).waitFor();
}

async function testAdmin(page) {
  await page.goto(`${frontendUrl}/login`, { waitUntil: 'networkidle' });
  await assertStyled(page, 'Login page');
  await fillBySelector(page, 'input', '2026');
  await clickUnique(page, 'button', 'Admin panelga kirish');
  await page.waitForURL('**/admin', { timeout: 10_000 });
  await assertStyled(page, 'Admin page');
  await page.getByText('Tariflarni boshqarish').waitFor();

  const nameField = page.locator('input[placeholder="Tariff nomi"]');
  const testTariffName = `SMALL TEST ${Date.now()}`;
  await nameField.fill(testTariffName);
  await page.locator('select').selectOption('SMALL');
  const numberFields = page.locator('input[type="number"]');
  await numberFields.nth(0).fill('15');
  await numberFields.nth(1).fill('5555');
  await clickUnique(page, 'button', "Qo'shish");
  await page.getByText(testTariffName, { exact: true }).waitFor();

  const tariffRow = page.locator('div').filter({ hasText: testTariffName }).filter({ hasText: '5,555 UZS' });
  assert((await tariffRow.count()) > 0, 'New tariff did not appear in admin list');

  await page.getByText('Yashik monitoringi').waitFor();
  const lockerButton = page.getByRole('button', { name: /L-01/ });
  if ((await lockerButton.count()) === 1) {
    await lockerButton.click();
    await page.getByText('Yashik boshqaruvi', { exact: true }).waitFor();
    await clickUnique(page, 'button', 'Yopish');
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('pageerror', (error) => {
    throw error;
  });

  try {
    await testTerminal(page);
    await testAdmin(page);
  } finally {
    await browser.close();
  }

  console.log('[OK] Local UI smoke passed');
}

main().catch((error) => {
  console.error('[FAIL] Local UI smoke failed');
  console.error(error);
  process.exit(1);
});
