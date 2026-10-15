import assert from 'assert';
import { db } from '../server/db';
import { LicenseRecord, ValidationTokenPayload } from '../server/types';

async function runTests() {
  console.log('🧪 Starting AI - Micro Trader Licensing Test Suite...\n');

  // Test 1: Admin User Provisioning and Password Security
  console.log('▶ Test 1: Admin User Provisioning & PBKDF2 Password Hashing');
  const initialHasAdmin = db.hasAdminUser();
  let adminUser;
  if (!initialHasAdmin) {
    adminUser = db.createFirstAdmin('test_admin', 'StrongMasterPass123!');
    assert(adminUser.id.startsWith('admin_'), 'Admin ID format mismatch');
    assert(adminUser.username === 'test_admin', 'Admin username mismatch');
    assert(adminUser.passwordHash.length === 128, 'PBKDF2 SHA-512 hash length must be 128 hex chars');
    assert(adminUser.salt.length === 32, 'Salt length must be 32 hex chars');
    console.log('  ✔ First administrator provisioned with salted hash');
  } else {
    adminUser = db.getAdminByUsername('test_admin');
    console.log('  ✔ Using existing admin');
  }

  // Verify password comparison
  const isValidPass = db.verifyPassword('StrongMasterPass123!', adminUser!.passwordHash, adminUser!.salt);
  assert(isValidPass === true, 'Valid password verification failed');
  const isInvalidPass = db.verifyPassword('WrongPassword', adminUser!.passwordHash, adminUser!.salt);
  assert(isInvalidPass === false, 'Invalid password must not verify');
  console.log('  ✔ Password verification timing-safe check passed');

  // Test 2: Access-Code Cryptographic Generation & Hash Storage
  console.log('\n▶ Test 2: Cryptographic Access-Code Generation & Hash Verification');
  const { record: lic1, rawCode: rawCode1 } = db.createLicense({
    type: 'Monthly',
    durationDays: 30,
    maxDevices: 2,
    note: 'Test Customer A',
    gracePeriodHours: 72,
    actor: 'test_admin',
    ip: '127.0.0.1',
  });

  assert(rawCode1.startsWith('MTR-'), 'Access code must have MTR- prefix');
  assert(lic1.codePrefix === rawCode1.slice(0, 8), 'License prefix must match');
  assert(lic1.codeHash === db.hashAccessCode(rawCode1), 'Stored hash must equal SHA-256 of code');
  assert(lic1.status === 'NOT_ACTIVATED', 'New license initial status must be NOT_ACTIVATED');
  console.log(`  ✔ Generated code ${rawCode1} with SHA-256 hash stored`);

  // Test 3: Duplicate Code Prevention
  console.log('\n▶ Test 3: Duplicate Code Prevention');
  const generatedCodes = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const code = db.generateSecureAccessCode();
    assert(!generatedCodes.has(code), `Duplicate code generated: ${code}`);
    generatedCodes.add(code);
  }
  console.log('  ✔ 20 consecutive codes generated with 0 duplicates (unpredictable entropy)');

  // Test 4: Windows and Android Device Activation Flows
  console.log('\n▶ Test 4: Windows and Android Activation Flows');
  const winDeviceId = 'WIN-HWID-DESKTOP-9921';
  const andDeviceId = 'AND-AID-SAMSUNG-4412';

  // Windows Activation
  const winResult = db.activateLicense({
    rawCode: rawCode1,
    deviceId: winDeviceId,
    platform: 'windows',
    deviceName: 'Windows Trading Rig',
    ip: '192.168.1.10',
  });
  assert(winResult.success === true, 'Windows activation failed');
  assert(winResult.state === 'ACTIVE', 'State must be ACTIVE');
  assert(winResult.token !== undefined, 'Validation token must be issued');
  console.log('  ✔ Windows client activated successfully');

  // Android Activation (Device 2 / Max 2)
  const andResult = db.activateLicense({
    rawCode: rawCode1,
    deviceId: andDeviceId,
    platform: 'android',
    deviceName: 'Android Galaxy Fold',
    ip: '192.168.1.11',
  });
  assert(andResult.success === true, 'Android activation failed');
  assert(andResult.state === 'ACTIVE', 'State must be ACTIVE');
  console.log('  ✔ Android client activated successfully');

  // Test 5: Device Limit Enforcement
  console.log('\n▶ Test 5: Device Limits Enforcement (3rd device on max 2 license)');
  const thirdDeviceId = 'WIN-LAPTOP-7711';
  const thirdResult = db.activateLicense({
    rawCode: rawCode1,
    deviceId: thirdDeviceId,
    platform: 'windows',
    deviceName: 'Unauthorized 3rd Device',
    ip: '192.168.1.12',
  });
  assert(thirdResult.success === false, 'Device limit was not enforced');
  assert(thirdResult.state === 'DEVICE_LIMIT_REACHED', 'State must be DEVICE_LIMIT_REACHED');
  console.log('  ✔ Device limit correctly blocked 3rd activation with DEVICE_LIMIT_REACHED');

  // Test 6: Invalid Activation Codes
  console.log('\n▶ Test 6: Invalid and Tampered Activation Codes');
  const invalidResult = db.activateLicense({
    rawCode: 'MTR-FAKE-FAKE-FAKE',
    deviceId: 'ANY-DEV',
    platform: 'windows',
    deviceName: 'Fake Device',
    ip: '127.0.0.1',
  });
  assert(invalidResult.success === false, 'Invalid code should fail');
  assert(invalidResult.state === 'NOT_ACTIVATED', 'Invalid code returns NOT_ACTIVATED');
  console.log('  ✔ Fake access code rejected with NOT_ACTIVATED error');

  // Test 7: Offline Grace-Period Token Signing & Expiration Verification
  console.log('\n▶ Test 7: Offline Grace-Period Signature & Expiration');
  const validTokenPayload: ValidationTokenPayload = {
    licId: lic1.id,
    type: lic1.type,
    deviceId: winDeviceId,
    platform: 'windows',
    validUntil: lic1.expiresAt,
    graceUntil: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    issuedAt: new Date().toISOString(),
  };
  const signedToken = db.signLicenseToken(validTokenPayload);
  const verifiedPayload = db.verifyLicenseToken(signedToken);
  assert(verifiedPayload !== null, 'Valid HMAC signature failed verification');
  assert(verifiedPayload?.licId === lic1.id, 'Payload licId mismatch');

  // Tampered Token
  const tamperedToken = `${signedToken.slice(0, 20)}X${signedToken.slice(21)}`;
  const tamperedVerified = db.verifyLicenseToken(tamperedToken);
  assert(tamperedVerified === null, 'Tampered token must fail HMAC verification');
  console.log('  ✔ HMAC-SHA256 license token correctly validates and prevents forgery');

  // Test 8: License Revocation
  console.log('\n▶ Test 8: License Revocation Enforcement');
  const revokeSuccess = db.revokeLicense(lic1.id, 'Fraudulent chargeback detected', 'test_admin', '127.0.0.1');
  assert(revokeSuccess === true, 'Revocation failed');

  const reVerifyResult = db.verifyDeviceStatus(winResult.token!, winDeviceId, '127.0.0.1');
  assert(reVerifyResult.valid === false, 'Revoked license should not verify');
  assert(reVerifyResult.state === 'REVOKED', 'State must be REVOKED');
  console.log('  ✔ Revocation took effect immediately; device rejected with REVOKED state');

  // Test 9: License Renewal and Reactivation
  console.log('\n▶ Test 9: License Renewal & Reactivation');
  const renewResult = db.renewLicense(lic1.id, 60, 'test_admin', '127.0.0.1');
  assert(renewResult.success === true, 'License renewal failed');
  const updatedLic = db.getLicenseById(lic1.id);
  assert(updatedLic?.status === 'ACTIVE', 'Renewed license must be restored to ACTIVE');
  console.log('  ✔ License renewed for +60 days; restored to ACTIVE state');

  // Test 10: Device Activation Reset
  console.log('\n▶ Test 10: Authorized Device Activations Reset');
  const resetSuccess = db.resetAllDevices(lic1.id, 'test_admin', '127.0.0.1');
  assert(resetSuccess === true, 'Reset devices failed');
  const resetLic = db.getLicenseById(lic1.id);
  assert(resetLic?.devices.length === 0, 'Device list must be cleared after reset');
  console.log('  ✔ All devices reset; new hardware can now activate');

  // Test 11: Expired License Behavior
  console.log('\n▶ Test 11: Expired License State Handling');
  const { record: expiredLic, rawCode: expCode } = db.createLicense({
    type: 'Trial',
    durationDays: 1,
    maxDevices: 1,
    note: 'Expiring Test',
    actor: 'test_admin',
    ip: '127.0.0.1',
  });
  // Manually backdate expiration
  expiredLic.expiresAt = new Date(Date.now() - 100000).toISOString();
  db.refreshLicenseStatus(expiredLic);
  assert(expiredLic.status === 'EXPIRED', 'Status must be EXPIRED when now > expiresAt');

  const expActivation = db.activateLicense({
    rawCode: expCode,
    deviceId: 'DEV-EXP',
    platform: 'windows',
    deviceName: 'Expired Test Machine',
    ip: '127.0.0.1',
  });
  assert(expActivation.success === false, 'Expired license must not activate');
  assert(expActivation.state === 'EXPIRED', 'State must be EXPIRED');
  console.log('  ✔ Expired license correctly rejected with EXPIRED state');

  // Test 12: Audit Logging Security
  console.log('\n▶ Test 12: Audit Trail Verification (No Plaintext Secrets)');
  const auditLogs = db.getAuditLogs(10);
  assert(auditLogs.length > 0, 'Audit logs must contain recorded events');
  const containsPlaintextCode = auditLogs.some((l) => l.details.includes(rawCode1));
  assert(!containsPlaintextCode, 'Plaintext access code must NEVER appear in audit logs');
  console.log('  ✔ Audit trail intact with zero leaked secrets/passwords');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎉 ALL 12 LICENSING & SECURITY INTEGRATION TESTS PASSED!');
  console.log('═══════════════════════════════════════════════════════════\n');
}

runTests().catch((err) => {
  console.error('❌ Test suite error:', err);
  process.exit(1);
});
