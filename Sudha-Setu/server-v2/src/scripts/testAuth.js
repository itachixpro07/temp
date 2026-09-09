import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const API = `${BASE}/api/auth`;

const TEST_EMAIL = `testuser_${Date.now()}@example.com`;
const TEST_PASSWORD = 'StrongP@ss123';
const TEST_NAME = 'Test Patient';

let savedCookies = '';

const extractCookies = (res) => {
  const raw = res.headers.getSetCookie?.() || [];
  return raw.map((c) => c.split(';')[0]).join('; ');
};

const mergeCookies = (existing, incoming) => {
  if (!incoming) return existing;
  const map = {};
  [existing, incoming].forEach((str) =>
    str.split('; ').filter(Boolean).forEach((pair) => {
      const [k] = pair.split('=');
      map[k] = pair;
    })
  );
  return Object.values(map).join('; ');
};

let passed = 0;
let failed = 0;

const assert = (condition, label) => {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
};

const run = async () => {
  console.log(`\n🔬 Sudha Setu Auth Tests — ${API}\n${'─'.repeat(50)}`);

  console.log('\n[1] POST /register — new patient');
  {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    const body = await res.json();
    const cookies = extractCookies(res);
    savedCookies = mergeCookies(savedCookies, cookies);

    assert(res.status === 201, `Status 201 (got ${res.status})`);
    assert(!cookies.includes('accessToken'), 'no accessToken cookie before email verification');
    assert(body.user?.email === TEST_EMAIL, 'Response contains user.email');
    assert(body.message?.toLowerCase().includes('verification'), 'Response tells the user to check email');
  }

  console.log('\n[2] POST /register — duplicate email');
  {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    assert(res.status === 400, `Status 400 (got ${res.status})`);
  }

  console.log('\n[2b] POST /verify-otp — using the code from the database');
  {
    const mongoose = (await import('mongoose')).default;
    await import('dotenv/config');
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    const User = (await import('../models/User.js')).default;
    const Otp = (await import('../models/Otp.js')).default;

    const user = await User.findOne({ email: TEST_EMAIL });
    const otp = await Otp.findOne({ userId: user._id, purpose: 'verify_email' }).sort({ _id: -1 });

    const res = await fetch(`${API}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, code: otp?.code }),
    });
    const body = await res.json();
    const cookies = extractCookies(res);
    savedCookies = mergeCookies(savedCookies, cookies);

    assert(res.status === 200, `Status 200 (got ${res.status})`);
    assert(cookies.includes('accessToken'), 'accessToken cookie set after verification');
    assert(body.user?.role === 'patient', 'Default role is patient');
  }

  console.log('\n[3] POST /login — correct credentials');
  {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    const body = await res.json();
    const cookies = extractCookies(res);
    savedCookies = mergeCookies(savedCookies, cookies);

    assert(res.status === 200, `Status 200 (got ${res.status})`);
    assert(cookies.includes('accessToken'), 'accessToken cookie refreshed');
    assert(body.user?.id, 'Response contains user.id');
  }

  console.log('\n[4a] GET /me — no token');
  {
    const res = await fetch(`${API}/me`);
    assert(res.status === 401, `Status 401 (got ${res.status})`);
  }

  console.log('\n[4b] GET /me — with cookie');
  {
    const res = await fetch(`${API}/me`, {
      headers: { Cookie: savedCookies },
    });
    const body = await res.json();

    assert(res.status === 200, `Status 200 (got ${res.status})`);
    assert(body.user?.name === TEST_NAME, `user.name matches (got "${body.user?.name}")`);
  }

  console.log('\n[5] GET /cases/queue — patient → 403 Forbidden');
  {
    const res = await fetch(`${BASE}/api/cases/queue`, {
      headers: { Cookie: savedCookies },
    });
    assert(res.status === 403, `Status 403 (got ${res.status})`);
  }

  console.log('\n[6] POST /refresh — issue new access token');
  {
    const res = await fetch(`${API}/refresh`, {
      method: 'POST',
      headers: { Cookie: savedCookies },
    });
    const cookies = extractCookies(res);

    assert(res.status === 200, `Status 200 (got ${res.status})`);
    assert(cookies.includes('accessToken'), 'New accessToken cookie set');

    savedCookies = mergeCookies(savedCookies, cookies);
  }

  console.log('\n[7] GET /me — after refresh');
  {
    const res = await fetch(`${API}/me`, {
      headers: { Cookie: savedCookies },
    });
    assert(res.status === 200, `Status 200 (got ${res.status})`);
  }

  console.log('\n[8] POST /logout');
  {
    const res = await fetch(`${API}/logout`, {
      method: 'POST',
      headers: { Cookie: savedCookies },
    });
    const body = await res.json();
    const cookies = extractCookies(res);

    assert(res.status === 200, `Status 200 (got ${res.status})`);
    assert(body.message === 'Logged out successfully', 'Logout message returned');
    
    assert(cookies.includes('accessToken'), 'accessToken cookie cleared header present');
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  if (failed === 0) {
    console.log('🎉 All tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Review the output above.\n');
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('\n💥 Test runner error:', err.message);
  console.error('   Make sure the server is running: npm run dev\n');
  process.exit(1);
});
