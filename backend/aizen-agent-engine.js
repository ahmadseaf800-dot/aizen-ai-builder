/**
 * Aizen Agent Engine
 * Provider-neutral orchestration for the 16-stage builder roadmap.
 * This module never receives or stores bot secrets.
 */
const crypto = require("crypto");

const AIZEN_ROADMAP = Object.freeze([
  { id: 1, key: "coding-agent", name: "AI Coding Agent", stages: ["inspect", "plan", "edit", "review", "verify"] },
  { id: 2, key: "workspace", name: "Project Workspace", stages: ["files", "memory", "context", "changes"] },
  { id: 3, key: "self-repair", name: "AI Self Repair", stages: ["detect", "diagnose", "fix", "recheck"] },
  { id: 4, key: "testing", name: "Testing Engine", stages: ["generate", "run-safe-checks", "report"] },
  { id: 5, key: "preview", name: "Live Preview", stages: ["prepare", "serve", "health"] },
  { id: 6, key: "terminal", name: "Project Terminal", stages: ["command-policy", "execute-safe", "logs"] },
  { id: 7, key: "github", name: "GitHub Integration", stages: ["connect", "branch", "commit", "review"] },
  { id: 8, key: "versions", name: "Version History", stages: ["snapshot", "diff", "restore"] },
  { id: 9, key: "memory", name: "Project Memory", stages: ["facts", "decisions", "preferences", "retrieval"] },
  { id: 10, key: "router", name: "Smart AI Router", stages: ["classify", "select", "fallback", "recover"] },
  { id: 11, key: "security", name: "Security Scanner", stages: ["secrets", "auth", "injection", "permissions"] },
  { id: 12, key: "vision-builder", name: "Screenshot to Website", stages: ["vision", "layout", "components", "verify"] },
  { id: 13, key: "voice", name: "Voice Coding", stages: ["speech", "intent", "agent"] },
  { id: 14, key: "deploy", name: "One Click Deploy", stages: ["build", "health", "publish", "rollback"] },
  { id: 15, key: "agents", name: "AI Agent Team", stages: ["planner", "coder", "tester", "security", "reviewer"] },
  { id: 16, key: "autonomous", name: "Autonomous Builder", stages: ["plan", "build", "test", "repair", "secure", "deploy"] }
]);

const FORBIDDEN_COMMANDS = /(^|\s)(rm\s+-rf|mkfs|shutdown|reboot|:\(\)\{|curl\s+[^\n]*\|\s*(sh|bash)|wget\s+[^\n]*\|\s*(sh|bash))(\s|$)/i;

function createRunId() {
  return `az_${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`;
}

function roadmapStatus({ completed = [] } = {}) {
  const set = new Set(completed.map(Number));
  return AIZEN_ROADMAP.map(item => ({ ...item, completed: set.has(item.id) }));
}

function classifyRequest(text = "") {
  const t = String(text).toLowerCase();
  if (/screenshot|صورة|واجهة|تصميم/.test(t)) return "vision-builder";
  if (/test|اختبار|اختبر/.test(t)) return "testing";
  if (/security|أمان|ثغرة|حماية/.test(t)) return "security";
  if (/github|commit|pull request|كيت هاب/.test(t)) return "github";
  if (/deploy|نشر|استضافة|ارفع/.test(t)) return "deploy";
  if (/voice|صوت|تكلم/.test(t)) return "voice";
  if (/fix|debug|صلح|خطأ|error/.test(t)) return "self-repair";
  if (/build|ابني|أنشئ|صمم|طور/.test(t)) return "autonomous";
  return "coding-agent";
}

function buildAgentPlan({ request, projectType = "custom" }) {
  const primary = classifyRequest(request);
  return {
    run_id: createRunId(),
    primary_stage: primary,
    project_type: projectType,
    phases: [
      "inspect: اقرأ المشروع والسياق الحالي دون كشف الأسرار",
      "plan: حدد الملفات والاعتمادات والنتيجة المتوقعة",
      "edit: طبّق أقل تغييرات لازمة مع الحفاظ على الموجود",
      "review: راجع syntax/imports/routes/state/security/UX",
      "verify: نفّذ فحوصاً آمنة متاحة قبل إعلان النجاح"
    ],
    success_criteria: [
      "لا توجد مسارات ملفات خارج المشروع",
      "لا توجد أسرار داخل الملفات الناتجة",
      "لا يتم حذف ملفات قائمة بلا طلب صريح",
      "المشروع يحتوي الملفات الأساسية لنوعه",
      "الفشل يعيد سبباً قابلاً للتشخيص بدلاً من رسالة عامة"
    ]
  };
}

function safeCommand(command) {
  const value = String(command || "").trim();
  if (!value || value.length > 500) return { allowed: false, reason: "INVALID_COMMAND" };
  if (FORBIDDEN_COMMANDS.test(value)) return { allowed: false, reason: "DANGEROUS_COMMAND" };
  return { allowed: true, command: value };
}

function staticVerifyFiles(files = []) {
  const findings = [];
  const seen = new Set();
  for (const file of files) {
    const p = String(file?.path || "").trim();
    const c = String(file?.content || "");
    if (!p || p.includes("..") || p.startsWith("/") || p.startsWith(".git/")) findings.push({ severity: "error", file: p, message: "مسار ملف غير آمن" });
    if (seen.has(p)) findings.push({ severity: "warning", file: p, message: "الملف مكرر" });
    seen.add(p);
    if (/(api[_-]?key|secret|password|bot[_-]?token|authorization\s*[:=])/i.test(c) && !/process\.env|import\.meta\.env|environment/i.test(c)) {
      findings.push({ severity: "warning", file: p, message: "قد يحتوي الملف على سر أو اعتماد؛ راجعه قبل النشر" });
    }
    if (/\beval\s*\(/.test(c)) findings.push({ severity: "warning", file: p, message: "استخدام eval يحتاج مراجعة أمنية" });
  }
  return { ok: !findings.some(x => x.severity === "error"), findings };
}

function buildAutonomousInstructions({ request, project, files }) {
  const plan = buildAgentPlan({ request, projectType: project?.type || "custom" });
  const verification = staticVerifyFiles(files);
  return {
    plan,
    verification,
    instruction: [
      "Aizen Autonomous Builder:",
      `RUN_ID=${plan.run_id}`,
      `PRIMARY_STAGE=${plan.primary_stage}`,
      "نفّذ inspect -> plan -> edit -> review -> verify.",
      "لا تضع التوكنات أو المفاتيح داخل FILE blocks.",
      "إذا فشل التحقق، أصلح الملفات قبل إعلان النجاح.",
      "إذا لم يكن التنفيذ الفعلي متاحاً، لا تدّعِ أنه تم."
    ].join("\n")
  };
}

module.exports = { AIZEN_ROADMAP, createRunId, roadmapStatus, classifyRequest, buildAgentPlan, safeCommand, staticVerifyFiles, buildAutonomousInstructions };
