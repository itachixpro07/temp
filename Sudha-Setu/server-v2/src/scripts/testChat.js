import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:5000';
const API  = `${BASE}/api/ai`;

const TEST_EMAIL    = `chat_${Date.now()}@test.com`;
const TEST_PASSWORD = 'StrongP@ss123';
const TEST_NAME     = 'Chat Test User';

let accessCookies = '';
let sessionChatId = '';

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

const json = (method, url, body, cookies = '') =>
  fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookies ? { Cookie: cookies } : {}),
    },
    ...(body !== null ? { body: JSON.stringify(body) } : {}),
  });

const setupUser = async () => {
  const mongoose = (await import('mongoose')).default;
  await import('dotenv/config');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const User = (await import('../models/User.js')).default;
  const Otp  = (await import('../models/Otp.js')).default;

  await json('POST', `${BASE}/api/auth/register`, {
    name: TEST_NAME, email: TEST_EMAIL, password: TEST_PASSWORD,
  });

  const user = await User.findOne({ email: TEST_EMAIL });
  const otp  = await Otp.findOne({ userId: user._id, purpose: 'verify_email' }).sort({ _id: -1 });

  const verifyRes = await json('POST', `${BASE}/api/auth/verify-otp`, {
    email: TEST_EMAIL, code: otp?.code,
  });
  accessCookies = mergeCookies(accessCookies, extractCookies(verifyRes));

};

const run = async () => {
  console.log(`\n🤖 Sudha Setu AI Chat Tests — ${API}\n${'─'.repeat(55)}`);

  await setupUser();

  console.log('\n[1] POST /chat — no auth token → 401');
  {
    const res = await json('POST', `${API}/chat`, { message: 'Hello' });
    assert(res.status === 401, `Status 401 (got ${res.status})`);
  }

  console.log('\n[2] POST /chat — empty message body → 400');
  {
    const res = await json('POST', `${API}/chat`, { message: '' }, accessCookies);
    assert(res.status === 400, `Status 400 (got ${res.status})`);
  }

  console.log('\n[3] POST /chat — message too long → 400');
  {
    const res = await json(
      'POST', `${API}/chat`,
      { message: 'x'.repeat(2001) },
      accessCookies
    );
    assert(res.status === 400, `Status 400 (got ${res.status})`);
  }

  console.log('\n[4] POST /chat — first message (new session)');
  {
    const res  = await json(
      'POST', `${API}/chat`,
      { message: 'I have a mild headache and feel tired. Any Ayurvedic suggestions?' },
      accessCookies
    );
    const body = await res.json();
    sessionChatId = body.chatId;

    assert(res.status === 200,        `Status 200 (got ${res.status})`);
    assert(typeof body.reply === 'string' && body.reply.length > 0, 'reply is a non-empty string');
    assert(typeof body.chatId === 'string' && body.chatId.length > 0, `chatId returned: ${body.chatId}`);
    assert(body.messageCount === 2,   `messageCount is 2 (got ${body.messageCount})`);
  }

  console.log('\n[5] POST /chat — follow-up message (same chatId)');
  {
    const res  = await json(
      'POST', `${API}/chat`,
      { message: 'What dietary changes would you suggest for better digestion?', chatId: sessionChatId },
      accessCookies
    );
    const body = await res.json();

    assert(res.status === 200,                  `Status 200 (got ${res.status})`);
    assert(body.chatId === sessionChatId,       'Same chatId returned for continuing session');
    assert(typeof body.reply === 'string' && body.reply.length > 0, 'Follow-up reply is non-empty');
    assert(body.messageCount === 4,             `messageCount is 4 (got ${body.messageCount})`);
  }

  console.log('\n[6] GET /chat/:chatId — no auth token → 401');
  {
    const res = await fetch(`${API}/chat/${sessionChatId}`);
    assert(res.status === 401, `Status 401 (got ${res.status})`);
  }

  console.log('\n[7] GET /chat/:chatId — retrieve full history');
  {
    const res  = await fetch(`${API}/chat/${sessionChatId}`, {
      headers: { Cookie: accessCookies },
    });
    const body = await res.json();

    assert(res.status === 200,              `Status 200 (got ${res.status})`);
    assert(Array.isArray(body.messages),    'messages is an array');
    assert(body.messages.length === 4,      `4 messages persisted (got ${body.messages.length})`);
    assert(body.messages[0]?.sender === 'user', 'First message sender is user');
    assert(body.messages[1]?.sender === 'ai',   'Second message sender is ai');
    assert(body.messages[2]?.sender === 'user', 'Third message sender is user');
    assert(body.messages[3]?.sender === 'ai',   'Fourth message sender is ai');
    assert(typeof body.messageCount === 'number', `messageCount field present (${body.messageCount})`);
  }

  console.log('\n[8] GET /chat/:id — non-existent chatId → 404');
  {
    const fakeId = '000000000000000000000001';
    const res = await fetch(`${API}/chat/${fakeId}`, {
      headers: { Cookie: accessCookies },
    });
    assert(res.status === 404, `Status 404 (got ${res.status})`);
  }

  console.log('\n[9] POST /chat — non-existent chatId → 404');
  {
    const res  = await json(
      'POST', `${API}/chat`,
      { message: 'Test', chatId: '000000000000000000000001' },
      accessCookies
    );
    assert(res.status === 404, `Status 404 (got ${res.status})`);
  }

  console.log('\n[10] POST /chat — malformed chatId → 400');
  {
    const res  = await json(
      'POST', `${API}/chat`,
      { message: 'Test', chatId: 'not-a-valid-object-id' },
      accessCookies
    );
    assert(res.status === 400, `Status 400 (got ${res.status})`);
  }

  const mongoose = (await import('mongoose')).default;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
  }

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  if (failed === 0) {
    console.log('🎉 All AI Chat tests passed!\n');
  } else {
    console.log('⚠️  Some tests failed. Review the output above.\n');
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('\n💥 Test runner error:', err);
  console.error('   Make sure the server is running: npm run dev\n');
  process.exit(1);
});
