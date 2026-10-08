import { runAllScenarios } from '../src/server/scenarios.js';

async function test() {
  console.log('Running all 14 H9loop support scenarios...');
  const metrics = await runAllScenarios();
  console.log('Results summary:');
  console.log(`Total Scenarios: ${metrics.totalScenarios}`);
  console.log(`Passed: ${metrics.passedScenarios}`);
  console.log(`Failed: ${metrics.failedScenarios}`);
  console.log(`FCR Rate: ${metrics.fcrRate}% (Target: >=80%)`);
  console.log(`Correct Escalation Rate: ${metrics.correctEscalationRate}% (Target: 100%)`);
  console.log(`Tool Accuracy: ${metrics.toolAccuracyRate}%`);
  console.log(`Policy Compliance: ${metrics.policyComplianceRate}%`);
  console.log(`Duplicate Refunds: ${metrics.duplicateRefunds}`);

  metrics.results.forEach((r) => {
    console.log(`[${r.passed ? 'PASS' : 'FAIL'}] ${r.scenarioId}: ${r.name}`);
    console.log(`   Expected: ${r.expectedOutcome}`);
    console.log(`   Actual:   ${r.actualOutcome}`);
  });
}

test().catch(console.error);
