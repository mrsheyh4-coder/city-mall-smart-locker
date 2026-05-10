const { fail, ok, requestJson, warn } = require('./shared');

const API = process.env.QA_API_URL ?? 'http://localhost:4000/api';
const WEB = process.env.QA_WEB_URL ?? 'http://localhost:3000';
const headers = { 'X-API-Version': '1' };

const state = {
  adminToken: '',
  touchedLockers: new Set(),
};

main().catch(async (error) => {
  fail(error.message);
  await cleanup();
  process.exit(1);
});

async function main() {
  console.log('Smart Locker QA smoke started\n');

  await assertFrontendRoute('/', 'home');
  await assertFrontendRoute('/terminal', 'terminal');
  await assertFrontendRoute('/admin', 'admin');
  await loginAdmin();

  const before = await getLockers();
  assert(before.data.length >= 1, 'Lockers list is not empty');

  const primary = findAvailable(before.data);
  const secondary = findAvailable(before.data, primary.number);
  assert(primary, 'At least one available locker exists for QA');

  state.touchedLockers.add(primary.number);
  await customerFlow(primary);

  if (secondary) {
    state.touchedLockers.add(secondary.number);
    await expireFlow(secondary);
  } else {
    warn('Skipped expire flow because no second available locker was found');
  }

  await maintenanceFlow(primary.number);
  await adminFlow();
  await cleanup();

  ok('QA smoke completed successfully');
}

async function customerFlow(locker) {
  const phone = `+99890${String(locker.number).padStart(7, '0')}`;
  const sms = await post('/sms/auth/request', { phone });
  assert(sms.devCode, 'SMS demo code is returned for QA');
  const verified = await post('/sms/auth/verify', {
    phone,
    code: sms.devCode,
  });
  assert(verified.token, 'SMS verification token is returned');

  const created = await post('/booking/create', {
    lockerId: locker.number,
    lockerSize: locker.size,
    durationMinutes: 60,
    phone,
    customerName: `QA Customer ${locker.number}`,
    termsAccepted: true,
    smsVerificationToken: verified.token,
  });

  assert(created.booking?.id, 'Booking is created');
  assert(created.access?.pinCode?.length === 6, '6-digit PIN is generated');
  assert(created.access?.qrCode, 'QR payload is generated');
  assert(created.data?.status === 'RESERVED', 'Locker moves to RESERVED after booking');

  const invalidAccess = await post('/access/verify', {
    lockerId: locker.number,
    credential: '000000',
  });
  assert(invalidAccess.valid === false, 'Invalid PIN is rejected');

  const paid = await post('/payment/mock', { bookingId: created.booking.id });
  assert(paid.payment?.status === 'SUCCESS', 'Mock payment succeeds');
  assert(paid.data?.status === 'OCCUPIED', 'Locker moves to OCCUPIED after payment');
  assert(paid.access?.pinCode === created.access.pinCode, 'Payment returns the same PIN');

  const validPin = await post('/access/verify', {
    lockerId: locker.number,
    credential: paid.access.pinCode,
  });
  assert(validPin.valid === true, 'Valid PIN opens locker');

  const validQr = await post('/access/verify', {
    lockerId: locker.number,
    credential: paid.access.qrCode,
  });
  assert(validQr.valid === true, 'Valid QR opens locker');

  const released = await post('/locker/release', { lockerId: locker.number });
  assert(released.data?.status === 'AVAILABLE', 'Release returns locker to AVAILABLE');
}

async function expireFlow(locker) {
  const phone = `+99891${String(locker.number).padStart(7, '0')}`;
  const sms = await post('/sms/auth/request', { phone });
  const verified = await post('/sms/auth/verify', {
    phone,
    code: sms.devCode,
  });
  const created = await post('/booking/create', {
    lockerId: locker.number,
    lockerSize: locker.size,
    durationMinutes: 60,
    phone,
    customerName: `QA Expire ${locker.number}`,
    termsAccepted: true,
    smsVerificationToken: verified.token,
  });

  assert(created.data?.status === 'RESERVED', 'Expire flow booking starts as RESERVED');

  const expired = await post('/locker/expire', { lockerId: locker.number });
  assert(expired.data?.status === 'EXPIRED', 'Manual expire moves locker to EXPIRED');

  const rejected = await post('/access/verify', {
    lockerId: locker.number,
    credential: created.access.pinCode,
  });
  assert(rejected.valid === false, 'Expired access is rejected');

  const released = await post('/locker/release', { lockerId: locker.number });
  assert(released.data?.status === 'AVAILABLE', 'Expired locker can be released');
}

async function maintenanceFlow(lockerNumber) {
  const maintenance = await post('/locker/maintenance', { lockerId: lockerNumber });
  assert(maintenance.data?.status === 'MAINTENANCE', 'Maintenance toggle enters MAINTENANCE');

  const restored = await post('/locker/maintenance', { lockerId: lockerNumber });
  assert(restored.data?.status === 'AVAILABLE', 'Maintenance toggle returns to AVAILABLE');
}

async function adminFlow() {
  const stats = await get('/admin/statistics');
  assert(stats.summary?.total >= 1, 'Admin statistics returns total lockers');
  assert(Array.isArray(stats.lockers), 'Admin statistics returns locker monitoring data');
  assert(Array.isArray(stats.tariffs), 'Admin statistics returns tariffs');
  assert(Array.isArray(stats.logs), 'Admin statistics returns logs');
  assert(Array.isArray(stats.accessLogs), 'Admin statistics returns access logs');
  assert(stats.report?.utilizationRate >= 0, 'Admin statistics returns report summary');

  const report = await get('/admin/reports');
  assert(report.summary?.bookings >= 0, 'Admin report returns booking summary');
  assert(Array.isArray(report.revenueSeries), 'Admin report returns revenue series');
}

async function loginAdmin() {
  const response = await post('/auth/admin/login', {
    pin: process.env.QA_ADMIN_PIN ?? '2026',
  });
  assert(response.token, 'Admin login returns token');
  state.adminToken = response.token;
}

async function cleanup() {
  for (const lockerId of state.touchedLockers) {
    try {
      await post('/locker/release', { lockerId });
    } catch {
      // Cleanup is best effort; the real failure is reported by the test that caused it.
    }
  }
}

async function assertFrontendRoute(path, name) {
  const response = await fetch(`${WEB}${path}`);
  assert(response.ok, `Frontend route ${name} responds with 2xx`);
  const html = await response.text();
  assert(html.includes('<html'), `Frontend route ${name} returns HTML`);
}

async function getLockers() {
  return get('/lockers');
}

function findAvailable(lockers, excludeNumber) {
  return lockers.find(
    (locker) =>
      locker.status === 'AVAILABLE' &&
      locker.isOpen === false &&
      locker.number !== excludeNumber,
  );
}

async function get(path) {
  const response = await requestJson(`${API}${path}`, getHeaders());
  assert(
    response.statusCode >= 200 && response.statusCode < 300,
    `GET ${path} returns 2xx`,
  );
  return response.body;
}

async function post(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  assert(response.ok, `POST ${path} returns 2xx (${JSON.stringify(payload)})`);
  return payload;
}

function getHeaders() {
  return {
    ...headers,
    ...(state.adminToken ? { Authorization: `Bearer ${state.adminToken}` } : {}),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }

  ok(message);
}
