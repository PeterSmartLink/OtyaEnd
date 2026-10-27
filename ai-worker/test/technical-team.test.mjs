import test from 'node:test'
import assert from 'node:assert/strict'
import { TECHNICAL_ROLES, evaluateTechnicalAction, routeTechnicalTask } from '../src/technical-team.mjs'

test('technical team exposes the coordinated specialist roles', () => {
  for (const role of ['team_lead', 'backend_engineer', 'database_engineer', 'devops_engineer', 'security_engineer', 'qa_engineer', 'python_automation_engineer', 'integration_engineer', 'business_systems_assistant', 'documentation_engineer']) {
    assert.ok(TECHNICAL_ROLES[role], role)
  }
})

test('routes D1 schema work to database engineer without granting access', () => {
  const result = routeTechnicalTask('Review the Cloudflare D1 schema and migration integrity')
  assert.equal(result.role, 'database_engineer')
  assert.equal(result.required_scope, 'database:inspect')
  assert.equal(result.confidence, 'medium')
})

test('security task routes before generic backend matching', () => {
  assert.equal(routeTechnicalTask('Audit authentication permissions and secret exposure').role, 'security_engineer')
})

test('unknown and empty tasks safely fall back to team lead', () => {
  assert.equal(routeTechnicalTask('something unusual').role, 'team_lead')
  assert.equal(routeTechnicalTask('').confidence, 'low')
})

test('read-only inspection requires trusted identity and read scope', () => {
  assert.equal(evaluateTechnicalAction('read_only_inspection', {}).code, 'AUTH_REQUIRED')
  assert.equal(evaluateTechnicalAction('read_only_inspection', { authenticated: true, scopes: ['inventory:read'] }).code, 'SCOPE_REQUIRED')
  assert.equal(evaluateTechnicalAction('read_only_inspection', { authenticated: true, scopes: ['ecosystem:read'] }).allowed, true)
})

test('high-impact actions require owner, step-up and explicit approval', () => {
  assert.equal(evaluateTechnicalAction('production_deploy', { authenticated: true }).code, 'OWNER_REQUIRED')
  assert.equal(evaluateTechnicalAction('production_deploy', { authenticated: true, is_owner: true }).code, 'STEP_UP_REQUIRED')
  assert.equal(evaluateTechnicalAction('production_deploy', { authenticated: true, is_owner: true, step_up_valid: true }).code, 'APPROVAL_REQUIRED')
  assert.deepEqual(evaluateTechnicalAction('production_deploy', { authenticated: true, is_owner: true, step_up_valid: true, explicit_approval: true }), { allowed: true, code: 'ALLOW_AFTER_APPROVAL' })
})

test('unknown actions are denied even for owner context', () => {
  assert.equal(evaluateTechnicalAction('arbitrary_shell_command', { authenticated: true, is_owner: true, step_up_valid: true, explicit_approval: true }).code, 'ACTION_NOT_REGISTERED')
})

test('payment and customer-facing side effects fail closed', () => {
  for (const action of ['live_payment', 'external_message', 'data_deletion', 'secret_change']) {
    assert.equal(evaluateTechnicalAction(action, { authenticated: true }).allowed, false)
  }
})
