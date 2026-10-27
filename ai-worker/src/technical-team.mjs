/**
 * Next technical-team registry.
 * Routing is advisory, not authorization or a tool executor.
 */
export const TECHNICAL_ROLES = Object.freeze({
  team_lead: { title: 'AI Team Lead', scope: 'ecosystem:coordinate', tasks: ['triage', 'planning', 'cross_product'] },
  backend_engineer: { title: 'Backend Engineer', scope: 'backend:inspect', tasks: ['api', 'worker', 'integration'] },
  database_engineer: { title: 'Database Engineer', scope: 'database:inspect', tasks: ['schema', 'query', 'integrity', 'migration_review'] },
  devops_engineer: { title: 'DevOps Engineer', scope: 'devops:inspect', tasks: ['ci', 'release', 'deployment_review'] },
  security_engineer: { title: 'Security Engineer', scope: 'security:inspect', tasks: ['security', 'permissions', 'dependency_audit'] },
  qa_engineer: { title: 'QA Engineer', scope: 'qa:run', tasks: ['tests', 'regression', 'acceptance'] },
  python_automation_engineer: { title: 'Python Automation Engineer', scope: 'automation:inspect', tasks: ['automation', 'reconciliation', 'reporting', 'evaluation'] },
  integration_engineer: { title: 'Integration Engineer', scope: 'integration:inspect', tasks: ['cloudflare', 'github', 'resend', 'payment_provider'] },
  business_systems_assistant: { title: 'OmniPoint Business Systems Assistant', scope: 'omnipoint:read', tasks: ['inventory', 'sales', 'cash_reconciliation', 'agency_operations'] },
  documentation_engineer: { title: 'Technical Documentation Engineer', scope: 'docs:write_branch', tasks: ['documentation', 'runbook', 'architecture_map'] },
});

const TASK_RULES = [
  { task: 'security', role: 'security_engineer', pattern: /security|vulnerab|permission|auth|secret|exposure/i },
  { task: 'schema', role: 'database_engineer', pattern: /schema|migration|query|database|\\bd1\\b|integrity|foreign key/i },
  { task: 'ci', role: 'devops_engineer', pattern: /\\bci\\b|workflow|github actions|build failure|release|deploy/i },
  { task: 'tests', role: 'qa_engineer', pattern: /test|regression|reproduc|acceptance|failing check/i },
  { task: 'automation', role: 'python_automation_engineer', pattern: /python|automati|scheduled|reconcil|report|evaluation/i },
  { task: 'payment_provider', role: 'integration_engineer', pattern: /payment|interswitch|quickteller|airtel|\\bmt[n]\\b|resend|webhook|cloudflare|github/i },
  { task: 'inventory', role: 'business_systems_assistant', pattern: /inventory|stock|cash|sales|float|commission|mobile money|agency/i },
  { task: 'api', role: 'backend_engineer', pattern: /api|worker|backend|endpoint|integration|route/i },
  { task: 'documentation', role: 'documentation_engineer', pattern: /document|readme|runbook|architecture|instructions/i },
];

const HIGH_IMPACT = new Set([
  'production_deploy', 'dns_change', 'secret_change', 'data_migration',
  'data_deletion', 'live_payment', 'external_message', 'permission_change',
  'billable_provisioning',
]);

export function routeTechnicalTask(taskText) {
  const text = String(taskText ?? '').trim().slice(0, 4000);
  if (!text) return {
    role: 'team_lead', task: 'triage', title: TECHNICAL_ROLES.team_lead.title,
    required_scope: TECHNICAL_ROLES.team_lead.scope, confidence: 'low',
    reason: 'Empty task; request clarification before taking action.',
  };
  const match = TASK_RULES.find((rule) => rule.pattern.test(text));
  const selected = match
    ? { task: match.task, role: match.role, confidence: 'medium' }
    : { task: 'triage', role: 'team_lead', confidence: 'low' };
  const role = TECHNICAL_ROLES[selected.role];
  return {
    ...selected, title: role.title, required_scope: role.scope,
    reason: match
      ? 'Keyword-based suggestion; verify the task and evidence before acting.'
      : 'No specialist matched; the team lead should clarify and delegate.',
  };
}

/** Trusted authentication context must come from server-side identity systems. */
export function evaluateTechnicalAction(actionType, context = {}) {
  const action = String(actionType ?? '');
  const scopes = new Set(Array.isArray(context.scopes) ? context.scopes : []);
  if (context.authenticated !== true) return { allowed: false, code: 'AUTH_REQUIRED' };

  if (action === 'read_only_inspection') {
    if (!scopes.has('ecosystem:read') && !scopes.has('admin:read')) {
      return { allowed: false, code: 'SCOPE_REQUIRED' };
    }
    return { allowed: true, code: 'ALLOW_READ_ONLY' };
  }
  if (!HIGH_IMPACT.has(action)) return { allowed: false, code: 'ACTION_NOT_REGISTERED' };
  if (context.is_owner !== true) return { allowed: false, code: 'OWNER_REQUIRED' };
  if (context.step_up_valid !== true) return { allowed: false, code: 'STEP_UP_REQUIRED' };
  if (context.explicit_approval !== true) return { allowed: false, code: 'APPROVAL_REQUIRED' };
  return { allowed: true, code: 'ALLOW_AFTER_APPROVAL' };
}
