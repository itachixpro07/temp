import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:5000';

const DOCTOR_EMAIL = `doc_${Date.now()}@test.com`;
const PATIENT_EMAIL = `pat_${Date.now()}@test.com`;
const PASSWORD = 'StrongP@ss123';

let doctorCookies = '';
let patientCookies = '';
let caseId = '';
let kbRuleId = '';

let passed = 0;
let failed = 0;

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
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

let mongoReady = false;
const getOtpCodeFor = async (email, purpose) => {
  const mongoose = (await import('mongoose')).default;
  await import('dotenv/config');
  if (!mongoReady) {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    mongoReady = true;
  }
  const User = (await import('../models/User.js')).default;
  const Otp = (await import('../models/Otp.js')).default;

  const user = await User.findOne({ email });
  const otp = await Otp.findOne({ userId: user._id, purpose }).sort({ _id: -1 });
  return otp?.code;
};

const run = async () => {
  console.log(`\n🔬 Prompt 1 Tests — ${BASE}\n${'─'.repeat(55)}`);

  console.log('\n[0a] Register patient, then verify email via OTP');
  {
    const res = await json('POST', `${BASE}/api/auth/register`, {
      name: 'Test Patient P1', email: PATIENT_EMAIL, password: PASSWORD,
    });
    assert(res.status === 201, `Patient registered (${res.status})`);

    const code = await getOtpCodeFor(PATIENT_EMAIL, 'verify_email');
    const verifyRes = await json('POST', `${BASE}/api/auth/verify-otp`, {
      email: PATIENT_EMAIL, code,
    });
    patientCookies = mergeCookies(patientCookies, extractCookies(verifyRes));
    assert(verifyRes.status === 200, `Patient verified and logged in (${verifyRes.status})`);
  }

  console.log('\n[0b] Login as seed admin, elevate a fresh account to doctor');
  {
    const adminLoginRes = await json('POST', `${BASE}/api/auth/login`, {
      email: 'seed.admin@sudhasetu.internal', password: 'ChangeThisSeedPassword123',
    });
    const adminCookies = extractCookies(adminLoginRes);
    assert(adminLoginRes.status === 200, `Seed admin login OK (${adminLoginRes.status})`);

    const regRes = await json('POST', `${BASE}/api/auth/register`, {
      name: 'Dr. Test P1', email: DOCTOR_EMAIL, password: PASSWORD,
    });
    assert(regRes.status === 201, `Doctor account registered (${regRes.status})`);
    const regBody = await regRes.json();
    const newUserId = regBody.user?.id;

    const doctorCode = await getOtpCodeFor(DOCTOR_EMAIL, 'verify_email');
    const doctorVerifyRes = await json('POST', `${BASE}/api/auth/verify-otp`, {
      email: DOCTOR_EMAIL, code: doctorCode,
    });
    assert(doctorVerifyRes.status === 200, `Doctor email verified (${doctorVerifyRes.status})`);

    const elevateRes = await json('POST', `${BASE}/api/admin/doctors`, {
      userId: newUserId,
      specialization: 'Panchakarma',
      medicalRegistrationNumber: `TEST-${Date.now()}`,
    }, adminCookies);
    assert(elevateRes.status === 201, `Admin elevated user to doctor (${elevateRes.status})`);

    const verifyDoctorId = (await elevateRes.json()).doctor?._id;
    const verifyRes = await json('PATCH', `${BASE}/api/admin/doctors/${verifyDoctorId}/verify`, {}, adminCookies);
    assert(verifyRes.status === 200, `Admin marked doctor as verified (${verifyRes.status})`);

    const loginRes = await json('POST', `${BASE}/api/auth/login`, {
      email: DOCTOR_EMAIL, password: PASSWORD,
    });
    doctorCookies = mergeCookies(doctorCookies, extractCookies(loginRes));
    const loginBody = await loginRes.json();
    assert(loginRes.status === 200, `Doctor login OK (${loginRes.status})`);
    assert(loginBody.user?.role === 'doctor', 'Doctor role actually took effect after elevation');
  }

  console.log('\n[1] POST /cases/intake — patient creates case');
  {
    const res = await json('POST', `${BASE}/api/cases/intake`, {
      patientText: 'I have a mild headache and acidity since morning',
    }, patientCookies);
    const body = await res.json();
    caseId = body.caseId;
    assert(res.status === 201, `Intake 201 (${res.status})`);
    assert(!!caseId, `caseId returned: ${caseId}`);
  }

  console.log('\n[2] PATCH /cases/:id — patient → 403');
  {
    const res = await json('PATCH', `${BASE}/api/cases/${caseId}`, {
      status: 'in_consultation',
    }, patientCookies);
    assert(res.status === 403, `Patient gets 403 (${res.status})`);
  }

  console.log('\n[3] PATCH /cases/:id — doctor updates');
  {
    const res = await json('PATCH', `${BASE}/api/cases/${caseId}`, {
      status: 'in_consultation',
      doctorNotes: 'Patient reports mild tension headache. Advise rest and hydration.',
      prescription: [
        {
          medicine: 'Triphala Churna',
          dosage: '5g',
          duration: '7 days',
          instructions: 'Take with warm water at bedtime',
        },
        {
          medicine: 'Avipattikar Churna',
          dosage: '3g',
          timing: 'After lunch',
          duration: '5 days',
          instructions: 'Mix with buttermilk',
        },
      ],
    }, doctorCookies);
    const body = await res.json();
    assert(res.status === 200, `Doctor PATCH 200 (${res.status})`);
    assert(body.case?.status === 'in_consultation', `Status updated to in_consultation`);
    assert(body.case?.doctorNotes?.includes('tension headache'), 'Doctor notes saved');
    assert(body.case?.prescription?.length === 2, `2 prescriptions saved`);
    assert(body.case?.prescription?.[0]?.medicineName === 'Triphala Churna', 'Medicine name mapped correctly');
  }

  console.log('\n[4] PATCH /cases/:id — mark completed');
  {
    const res = await json('PATCH', `${BASE}/api/cases/${caseId}`, {
      status: 'completed',
    }, doctorCookies);
    const body = await res.json();
    assert(res.status === 200, `Status update 200 (${res.status})`);
    assert(body.case?.status === 'completed', 'Status is completed');
  }

  console.log('\n[5] GET /cases/:id/pdf — PDF download');
  {
    const res = await fetch(`${BASE}/api/cases/${caseId}/pdf`, {
      headers: { Cookie: patientCookies },
    });
    assert(res.status === 200, `PDF 200 (${res.status})`);
    assert(
      res.headers.get('content-type')?.includes('application/pdf'),
      `Content-Type is application/pdf`
    );
    assert(
      res.headers.get('content-disposition')?.includes(`case-${caseId}.pdf`),
      'Content-Disposition has filename'
    );

    const buffer = Buffer.from(await res.arrayBuffer());
    assert(buffer.length > 100, `PDF has ${buffer.length} bytes`);
    assert(buffer.subarray(0, 5).toString() === '%PDF-', 'Starts with %PDF- magic bytes');
  }

  console.log('\n[6a] GET /api/kb — list rules (public)');
  {
    const res = await fetch(`${BASE}/api/kb`);
    const body = await res.json();
    assert(res.status === 200, `KB list 200 (${res.status})`);
    assert(typeof body.total === 'number', `total field present (${body.total})`);
    assert(Array.isArray(body.rules), 'rules is an array');
  }

  console.log('\n[6b] POST /api/kb — patient → 403');
  {
    const res = await json('POST', `${BASE}/api/kb`, {
      keywordTriggers: ['test trigger'],
      dangerClassification: 'low',
    }, patientCookies);
    assert(res.status === 403, `Patient cannot create rule (${res.status})`);
  }

  console.log('\n[6c] POST /api/kb — doctor creates rule');
  {
    const res = await json('POST', `${BASE}/api/kb`, {
      keywordTriggers: ['test trigger alpha', 'test beta'],
      dangerClassification: 'low',
      verifiedAdvice: {
        generalTips: ['This is a test tip'],
        safeRemedies: ['Test remedy'],
      },
    }, doctorCookies);
    const body = await res.json();
    kbRuleId = body.rule?._id;
    assert(res.status === 201, `Rule created 201 (${res.status})`);
    assert(!!kbRuleId, `Rule ID: ${kbRuleId}`);
    assert(body.rule?.keywordTriggers?.includes('test trigger alpha'), 'Trigger saved');
  }

  console.log('\n[6d] PUT /api/kb/:id — doctor updates rule');
  {
    const res = await json('PUT', `${BASE}/api/kb/${kbRuleId}`, {
      dangerClassification: 'medium',
      keywordTriggers: ['test trigger alpha', 'test beta', 'test gamma'],
    }, doctorCookies);
    const body = await res.json();
    assert(res.status === 200, `Rule updated 200 (${res.status})`);
    assert(body.rule?.dangerClassification === 'medium', 'Danger level updated');
    assert(body.rule?.keywordTriggers?.length === 3, '3 triggers after update');
  }

  console.log('\n[6e] GET /api/kb?search=gamma — search filter');
  {
    const res = await fetch(`${BASE}/api/kb?search=gamma`);
    const body = await res.json();
    assert(res.status === 200, `Search 200 (${res.status})`);
    assert(body.total >= 1, `Found rule(s) matching "gamma" (${body.total})`);
  }

  console.log('\n[6f] DELETE /api/kb/:id — doctor deletes rule');
  {
    const res = await json('DELETE', `${BASE}/api/kb/${kbRuleId}`, null, doctorCookies);
    const body = await res.json();
    assert(res.status === 200, `Delete 200 (${res.status})`);
    assert(body.message === 'Rule deleted', 'Delete message confirmed');
  }

  console.log('\n[6g] GET /api/kb/:id — deleted rule → 404');
  {
    const res = await fetch(`${BASE}/api/kb/${kbRuleId}`);
    assert(res.status === 404, `Deleted rule 404 (${res.status})`);
  }

  const mongoose = (await import('mongoose')).default;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false);
  }

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${passed + failed} assertions`);
  if (failed === 0) {
    console.log('🎉 All Prompt 1 tests passed!\n');
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
