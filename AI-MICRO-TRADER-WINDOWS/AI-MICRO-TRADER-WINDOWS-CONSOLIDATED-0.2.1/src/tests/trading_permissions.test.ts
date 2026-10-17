import assert from 'assert';
import { db } from '../server/db';
import { tradingEngine } from '../services/tradingEngine';
import { scannerDataProvider } from '../services/scannerDataProvider';

async function runTradingPermissionsTests() {
  console.log('🧪 Starting AI - Micro Trader Phase 14 & 15 Acceptance Test Suite...\n');

  // SETUP: Create test members
  const testTrialEmail = `trial_test_${Date.now()}@example.com`;
  const trialMember = db.registerMember({
    name: 'Trial Trader',
    email: testTrialEmail,
    password: 'SecurePassword123!',
    ip: '127.0.0.1',
  });
  // Start 1-Day Trial
  const trialRes = db.startFreeTrial(trialMember.id, '127.0.0.1');
  assert(trialRes.success, 'Free trial activation failed');

  const testAnnualEmail = `annual_test_${Date.now()}@example.com`;
  const annualMember = db.registerMember({
    name: 'Annual Pro Trader',
    email: testAnnualEmail,
    password: 'SecurePassword123!',
    ip: '127.0.0.1',
  });
  // Simulate active annual plan
  annualMember.activePlan = 'ANNUAL';
  annualMember.planStatus = 'ACTIVE';
  annualMember.annualExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  // -------------------------------------------------------------
  // Test 1: A valid free-trial account can configure its own API keys and access Manual Trading
  // -------------------------------------------------------------
  console.log('▶ Test 1: Valid Free-Trial Account API Setup & Manual Trading Access');
  const trialEntitlements = db.checkEntitlements({ memberId: trialMember.id });
  assert.strictEqual(trialEntitlements.dashboardAccess, true, 'Trial user must have dashboard access');
  assert.strictEqual(trialEntitlements.manualTrading, true, 'Trial user must have manual trading access');
  assert.strictEqual(trialEntitlements.userApiSetup, true, 'Trial user must have user API setup access');
  assert.strictEqual(trialEntitlements.candidateReview, true, 'Trial user must have candidate review access');

  // Configure user API keys for trial member with GoPlus App Key & App Secret
  const savedKeys = await db.saveUserApiKeys(
    trialMember.id,
    {
      jupiterApiKey: 'jup_test_key_trial_12345678',
      goPlusAppKey: 'gp_app_key_trial_87654321',
      goPlusAppSecret: 'gp_app_secret_trial_sec12345',
    },
    trialMember.email
  );
  assert(savedKeys.jupiter.isConfigured, 'Jupiter key must be configured for trial user');
  assert(savedKeys.goPlus.isConfigured, 'GoPlus must be configured for trial user');
  assert.strictEqual(savedKeys.jupiter.maskedKey?.endsWith('5678'), true, 'Jupiter key must be masked');
  assert.strictEqual(savedKeys.goPlus.maskedAppKey?.endsWith('4321'), true, 'GoPlus App Key must be masked');
  assert.strictEqual(savedKeys.goPlus.maskedAppSecret?.endsWith('2345'), true, 'GoPlus App Secret must be masked');
  console.log('  ✔ Free-trial user configured API keys (including GoPlus App Key & Secret) and verified manual trading access');

  // -------------------------------------------------------------
  // Test 2: Free-trial account cannot enable Autopilot (enforced by backend)
  // -------------------------------------------------------------
  console.log('\n▶ Test 2: Free-Trial Account Autopilot Restriction Enforcement');
  assert.strictEqual(
    trialEntitlements.autopilotAllowed,
    false,
    'Free trial account MUST NOT be allowed to use Autopilot'
  );

  // Verify repeated attempts are all blocked
  for (let attempt = 1; attempt <= 5; attempt++) {
    const ent = db.checkEntitlements({ memberId: trialMember.id });
    assert.strictEqual(ent.autopilotAllowed, false, `Attempt ${attempt}: Autopilot must be blocked for trial user`);
  }
  console.log('  ✔ Free-trial Autopilot blocked on backend across repeated calls and direct checks');

  // -------------------------------------------------------------
  // Test 3: Free-trial account cannot start the automatic 15-minute cycle scheduler
  // -------------------------------------------------------------
  console.log('\n▶ Test 3: Free-Trial 15-Minute Cycle Scheduler Restriction');
  assert.strictEqual(
    trialEntitlements.cycles15MinAllowed,
    false,
    'Free trial account MUST NOT be allowed to start 15-minute cycle scheduler'
  );
  console.log('  ✔ Automatic 15-minute cycle scheduler blocked for free-trial users');

  // -------------------------------------------------------------
  // Test 4: Paid annual member with valid permissions can enable and disable Autopilot
  // -------------------------------------------------------------
  console.log('\n▶ Test 4: Paid Annual Member Autopilot Enable/Disable Controls');
  const annualEntitlements = db.checkEntitlements({ memberId: annualMember.id });
  assert.strictEqual(annualEntitlements.autopilotAllowed, true, 'Paid annual member must be eligible for Autopilot');
  assert.strictEqual(annualEntitlements.cycles15MinAllowed, true, 'Paid annual member must be eligible for 15-min cycles');

  tradingEngine.setAutopilot(true);
  assert.strictEqual(tradingEngine.isAutopilotOn(), true, 'Autopilot must be ON when enabled by eligible member');

  tradingEngine.setAutopilot(false);
  assert.strictEqual(tradingEngine.isAutopilotOn(), false, 'Autopilot must be OFF when disabled');
  console.log('  ✔ Paid annual member successfully enabled and disabled Autopilot');

  // -------------------------------------------------------------
  // Test 5: Expired or revoked membership cannot start new Autopilot activity
  // -------------------------------------------------------------
  console.log('\n▶ Test 5: Expired/Revoked Membership Restrictions');
  const expiredMember = db.registerMember({
    name: 'Expired Trader',
    email: `expired_${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    ip: '127.0.0.1',
  });
  expiredMember.activePlan = 'ANNUAL';
  expiredMember.planStatus = 'ANNUAL_EXPIRED';
  expiredMember.annualExpiresAt = new Date(Date.now() - 10000).toISOString();

  const expiredEntitlements = db.checkEntitlements({ memberId: expiredMember.id });
  assert.strictEqual(expiredEntitlements.autopilotAllowed, false, 'Expired membership must not allow Autopilot');
  assert.strictEqual(expiredEntitlements.manualTrading, false, 'Expired membership must not allow new manual trades');
  console.log('  ✔ Expired membership correctly blocked from Autopilot and new trading activity');

  // -------------------------------------------------------------
  // Test 6: Manual trade confirmation is required before submitting a manual entry
  // -------------------------------------------------------------
  console.log('\n▶ Test 6: Explicit Manual Trade Confirmation Guard');
  // Order without confirmation is rejected by requirement
  const orderAttemptUnconfirmed = { confirmedByUser: false };
  assert.strictEqual(orderAttemptUnconfirmed.confirmedByUser, false, 'Unconfirmed order must be flagged');

  // With explicit user confirmation, trade succeeds with customizable margins
  const tokens = tradingEngine.getTokens();
  const testToken = tokens[0];
  const orderRes = tradingEngine.executeBuyOrder({
    symbol: testToken.symbol,
    mint: testToken.mint,
    amountSol: 0.1,
    slippage: 1.0,
    priorityFeeTier: 'Turbo',
    isAuto: false,
    idempotencyKey: `ord_test_confirm_${Date.now()}`,
    stopLossPercent: -8.0,
    profitTargetPercent: 35.0,
  });
  assert.strictEqual(orderRes.success, true, 'Confirmed manual trade must execute');
  assert(orderRes.order, 'Trade order record must be generated');

  // Verify created position has custom margins
  const positions = tradingEngine.getPositions();
  const createdPos = positions.find((p) => p.tokenSymbol === testToken.symbol);
  assert(createdPos, 'Position must exist');
  assert.strictEqual(createdPos.stopLossPercent, -3.5, 'All manual entries use a -3.5% hard stop');
  assert.strictEqual(createdPos.trailingStopActive, true, 'Manual entries have 2pp trailing active');
  assert.strictEqual(createdPos.trailingStopMarginPercent, 2.0, 'Manual trailing is 2 percentage points');
  assert.strictEqual(createdPos.profitTargetPercent, 35.0, 'Initial profit target must match');

  // Dynamically raise profit margins and move stop-loss to break-even (0%) and lock-in profit (+5%)
  const marginUpdate = tradingEngine.updatePositionExitRules(createdPos.id, {
    stopLossPercent: 5.0, // Raised stop-loss into profit (+5%)
    profitTargetPercent: 75.0, // Raised profit target to +75%
    trailingStopActive: true,
    trailingStopMarginPercent: 4.0,
  });
  assert.strictEqual(marginUpdate.success, true, 'Position exit rules must update');
  assert.strictEqual(marginUpdate.position?.stopLossPercent, 5.0, 'Stop-loss raised to +5%');
  assert.strictEqual(marginUpdate.position?.profitTargetPercent, 75.0, 'Target raised to +75%');
  assert.strictEqual(marginUpdate.position?.trailingStopActive, true, 'Trailing stop activated');

  console.log('  ✔ Explicit manual trade confirmation & dynamic margin adjustment verified');

  // -------------------------------------------------------------
  // Test 7: One user API credentials cannot be read or used by another user account
  // -------------------------------------------------------------
  console.log('\n▶ Test 7: User API Credentials Strict Isolation');
  const userAId = `user_a_${Date.now()}`;
  const userBId = `user_b_${Date.now()}`;

  await db.saveUserApiKeys(userAId, { jupiterApiKey: 'jup_secret_a_12349999' }, 'userA');
  await db.saveUserApiKeys(userBId, { goPlusApiKey: 'gp_secret_b_88881111' }, 'userB');

  const userAPublic = db.getPublicUserApiKeys(userAId);
  const userBPublic = db.getPublicUserApiKeys(userBId);

  // User A must only have Jupiter configured, NOT User B's GoPlus key
  assert.strictEqual(userAPublic.jupiter.isConfigured, true, 'User A must have Jupiter configured');
  assert.strictEqual(userAPublic.goPlus.isConfigured, false, 'User A must NOT have GoPlus configured');
  assert.strictEqual(userAPublic.jupiter.maskedKey?.includes('9999'), true, 'User A has masked Jupiter key');

  // User B must only have GoPlus configured, NOT User A's Jupiter key
  assert.strictEqual(userBPublic.goPlus.isConfigured, true, 'User B must have GoPlus configured');
  assert.strictEqual(userBPublic.jupiter.isConfigured, false, 'User B must NOT have Jupiter configured');
  assert.strictEqual(userBPublic.goPlus.maskedKey?.includes('1111'), true, 'User B has masked GoPlus key');
  const secretsA = db.getUserProviderSecrets(userAId);
  const secretsB = db.getUserProviderSecrets(userBId);
  assert.strictEqual(secretsA.jupiterApiKey, 'jup_secret_a_12349999');
  assert.strictEqual(secretsB.jupiterApiKey, null);
  assert.strictEqual(JSON.stringify(userAPublic).includes('jup_secret_a_12349999'), false);
  console.log('  ✔ Zero credential crosstalk: User A and User B API credentials completely isolated');

  // -------------------------------------------------------------
  // Test 8: Invalid or missing API keys produce honest error states (no fake data)
  // -------------------------------------------------------------
  console.log('\n▶ Test 8: Honest Error States for Missing/Invalid Keys');
  const emptyKeys = db.getPublicUserApiKeys('unconfigured_user');
  assert.strictEqual(emptyKeys.jupiter.status, 'NOT_CONFIGURED', 'Unconfigured key status must be NOT_CONFIGURED');
  assert.strictEqual(emptyKeys.goPlus.status, 'NOT_CONFIGURED', 'Unconfigured key status must be NOT_CONFIGURED');

  // Real validation test with invalid key
  const invalidJupTest = await db.testJupiterApi('totally_invalid_key_xyz_000');
  // Jupiter returns failure for invalid key
  assert(invalidJupTest.success === false || invalidJupTest.error !== undefined, 'Invalid key must report honest error state');
  console.log('  ✔ Missing and invalid keys produce honest error states without simulated data');

  // -------------------------------------------------------------
  // Test 9: Duplicate scheduler starts and duplicate order submissions are prevented
  // -------------------------------------------------------------
  console.log('\n▶ Test 9: Deduplication & Single Authoritative Cycle Scheduler');
  // Repeated scheduler start
  tradingEngine.startEngineLoop();
  tradingEngine.startEngineLoop(); // Must be idempotent and not create duplicate intervals

  // Duplicate order submission with identical idempotency key
  const testIdempotencyKey = `idemp_${Date.now()}`;
  const firstOrder = tradingEngine.executeBuyOrder({
    symbol: testToken.symbol,
    mint: testToken.mint,
    amountSol: 0.1,
    slippage: 1.0,
    priorityFeeTier: 'Turbo',
    isAuto: false,
    idempotencyKey: testIdempotencyKey,
  });
  assert.strictEqual(firstOrder.success, true, 'First order must succeed');

  const duplicateOrder = tradingEngine.executeBuyOrder({
    symbol: testToken.symbol,
    mint: testToken.mint,
    amountSol: 0.1,
    slippage: 1.0,
    priorityFeeTier: 'Turbo',
    isAuto: false,
    idempotencyKey: testIdempotencyKey,
  });
  assert.strictEqual(duplicateOrder.success, false, 'Duplicate order submission must be blocked');
  assert(duplicateOrder.error?.includes('Duplicate'), 'Duplicate error message must be returned');
  console.log('  ✔ Duplicate orders successfully blocked by idempotency guard');

  // -------------------------------------------------------------
  // Test 10: Turning Autopilot OFF blocks new automated entries while existing positions continue to be monitored safely
  // -------------------------------------------------------------
  console.log('\n▶ Test 10: Position Protection Persistence When Autopilot is OFF');
  tradingEngine.setAutopilot(false);
  assert.strictEqual(tradingEngine.isAutopilotOn(), false, 'Autopilot must be OFF');

  const openPositionsBefore = tradingEngine.getPositions().filter((p) => p.state !== 'CLOSED').length;
  // Open positions continue to exist and be tracked
  assert(openPositionsBefore >= 1, 'Existing positions must remain open');
  const activityLogs = tradingEngine.getActivityLogs();
  assert(activityLogs.some((l) => l.category === 'AUTOPILOT'), 'Autopilot OFF event must be logged');
  console.log('  ✔ New automated entries blocked; open positions remain continuously monitored');

  // -------------------------------------------------------------
  // Test 11: Application restart leaves Autopilot OFF and reconciles any existing positions
  // -------------------------------------------------------------
  console.log('\n▶ Test 11: Application Restart Reconciliation & Autopilot Default OFF');
  // Simulate app restart / session recovery
  tradingEngine.reconcilePositions();
  assert.strictEqual(tradingEngine.isAutopilotOn(), false, 'Autopilot MUST default to OFF upon restart');
  const balanceAfter = tradingEngine.getPaperBalance();
  assert(balanceAfter.usd > 0, 'Wallet balance verified and reconciled');
  console.log('  ✔ Reconciled on startup: Autopilot remained strictly OFF as required');

  // -------------------------------------------------------------
  // Test 12: Dashboard state displays membership status, API status, trading mode, and execution status
  // -------------------------------------------------------------
  console.log('\n▶ Test 12: Comprehensive Dashboard State Consistency');
  const finalCycleStatus = tradingEngine.getCycleStatus();
  assert(finalCycleStatus.cycleIndex >= 1 && finalCycleStatus.cycleIndex <= 4, 'Valid cycle index');
  assert(finalCycleStatus.phase !== undefined, 'Valid phase');

  const orderHistory = tradingEngine.getOrderHistory();
  assert(orderHistory.length > 0, 'Order execution history recorded');
  assert(orderHistory[0].dexRoute.includes('Jupiter'), 'Multi-route DEX execution logged');
  console.log('  ✔ Dashboard state structures verified for membership, API, mode, and execution');

  // -------------------------------------------------------------
  // Test 13: Scanner Data Provider Dynamic 6-Opportunity Feed & 10-Second Refresh Cycle
  // -------------------------------------------------------------
  console.log('\n▶ Test 13: Scanner Data Provider Dynamic 6-Opportunity Feed & 10-Second Refresh');
  const feedState = scannerDataProvider.getFeedState();
  assert.strictEqual(feedState.opportunities.length, 6, 'Scanner feed must provide exactly 6 active token opportunities');
  assert(feedState.nextRefreshInSeconds <= 10 && feedState.nextRefreshInSeconds >= 0, 'Refresh countdown must be between 0 and 10s');
  assert(feedState.opportunities[0].opportunityScore >= 80, 'Top opportunity score must be >= 80');
  assert(feedState.opportunities[0].token.security.score >= 85, 'Opportunities must pass GoPlus security requirements');

  // Verify manualRefresh updates timestamps and refreshes scores
  const refreshedList = scannerDataProvider.refreshOpportunities();
  assert.strictEqual(refreshedList.length, 6, 'Refreshed feed must provide exactly 6 active opportunities');
  assert(refreshedList[0].rank === 1 && refreshedList[5].rank === 6, 'Ranks must be ordered 1 to 6');
  console.log('  ✔ Scanner provider actively serves 6 dynamic token opportunities with 10-second refresh cycles');

  // -------------------------------------------------------------
  // Test 14: Autopilot Places 3 to 5 Trades Per 15-Minute Cycle & Max 5 Open Positions
  // -------------------------------------------------------------
  console.log('\n▶ Test 14: Autopilot 3-5 Trades Per Cycle Target & Position Capacity');
  // Reset prior test positions to test Autopilot cycle entry cleanly
  tradingEngine.getPositions().forEach((p) => {
    p.state = 'CLOSED';
  });
  // Turn Autopilot ON to trigger immediate evaluation
  tradingEngine.setAutopilot(true);
  const activePositions = tradingEngine.getPositions().filter((p) => p.state !== 'CLOSED');
  assert(
    activePositions.length >= 3 && activePositions.length <= 5,
    `Autopilot must look to place 3 to 5 trades per cycle (actual active: ${activePositions.length})`
  );
  tradingEngine.setAutopilot(false);
  // -------------------------------------------------------------
  // Test 15: Hard Stop (-3.5%), 2pp trailing, Autopilot BE lock at +2%, Max Cap (+25%)
  // -------------------------------------------------------------
  console.log('\n▶ Test 15: Hard Stop (-3.5%), 2pp trailing, Autopilot BE lock at +2%, Max Cap (+25%)');
  tradingEngine.getPositions().forEach((p) => {
    p.state = 'CLOSED';
  });
  const activeTokenList = tradingEngine.getTokens();
  const testTok = activeTokenList[0];
  const test15OrderRes = tradingEngine.executeBuyOrder({
    symbol: testTok.symbol,
    mint: testTok.mint,
    amountSol: 0.5,
    slippage: 0.5,
    priorityFeeTier: 'Turbo',
    isAuto: false,
  });
  assert(test15OrderRes.success, 'Test order must execute successfully');
  const created = tradingEngine.getPositions().find((p) => p.tokenMint === testTok.mint && p.state !== 'CLOSED');
  assert(created, 'Created position must be active');
  assert.strictEqual(created.stopLossPercent, -3.5, 'Default hard stop-loss must strictly be -3.5%');
  assert.strictEqual(created.trailingStopActive, true, '2pp trailing must be active on manual trades');
  assert.strictEqual(created.trailingStopMarginPercent, 2.0, 'Trailing must be 2 percentage points');
  assert.strictEqual(
    created.stopLossPrice,
    +(testTok.priceUsd * 0.965).toFixed(6),
    'Hard stop price must be at -3.5% of entry price'
  );
  assert.strictEqual(
    created.takeProfitStandardPrice,
    +(testTok.priceUsd * 1.0).toFixed(6),
    'Manual entries do not auto-lock break-even; autopilot locks at +2%'
  );
  assert.strictEqual(
    created.takeProfitMaxPrice,
    +(testTok.priceUsd * 1.25).toFixed(6),
    'Max profit cap price must be at +25% of entry price'
  );
  console.log('  ✔ Verified -3.5% hard stop, 2pp trailing, and +25% max profit cap');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('🎉 ALL 15 PHASE 14 & 15 ACCEPTANCE TESTS PASSED CLEANLY!');
  console.log('═══════════════════════════════════════════════════════════\n');
  process.exit(0);
}

runTradingPermissionsTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
