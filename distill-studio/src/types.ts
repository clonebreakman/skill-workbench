/** Distill Studio domain types (Phase 0–7 + dual export). */

export type SubjectType =
  | "self"
  | "known"
  | "public"
  | "fictional"
  | "historical"
  | "archetype";

export type EvidenceLevel = "L1" | "L2" | "L3" | "L4";
export type Sensitivity = "synthetic" | "redacted" | "raw";
export type AdapterKind = "mock" | "llm";

export type MaterialKind = "transcript" | "script" | "case" | "policy" | "other";

export type SubjectStatus = "draft" | "ready" | "published" | "archived";

/** Distill pipeline phase index (anyone-skill 0–7). */
export type DistillPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RunStatus =
  | "pending"
  | "running"
  | "draft"
  | "reviewed"
  | "published"
  | "failed";

export interface SubjectProfile {
  title?: string;
  org?: string;
  summary?: string;
  tags?: string[];
}

export interface EthicsState {
  consent: boolean;
  purposeOk: boolean;
  noRawPiiClaim: boolean;
  checkedAt?: string;
}

export interface IntakeAnswers {
  purpose: string;
  scope: string;
  taboo: string;
}

export interface Subject {
  id: string;
  slug: string;
  name: string;
  type: SubjectType;
  profile: SubjectProfile;
  ethics?: EthicsState;
  intake?: IntakeAnswers;
  status: SubjectStatus;
  tags?: string[];
  /** Currently activated published package (rollback pointer). */
  activePackageId?: string;
  createdAt: string;
}

export interface Material {
  id: string;
  subjectId: string;
  kind: MaterialKind;
  title: string;
  sensitivity: Sensitivity;
  fileName: string;
  path: string;
  hash: string;
  createdAt: string;
}

/** Training-export compatible work skill (BankExpertTrainer). */
export interface WorkSkill {
  scope: string;
  workflows: string[];
  decisionRules: string[];
  forbidden: string[];
  knowledgeRefs: string[];
  /** Distilly-style output preferences (docs/tables/结论先行等). */
  outputPreferences?: string[];
  /** Durable experience notes / heuristics from materials. */
  experienceNotes?: string[];
}

/**
 * Distilly colleague Persona 六层（硬规则→身份→表达→决策→人际→Correction）。
 * 导出时折叠进 Persona；训练端仍读扁平字段。
 */
export interface PersonaLayers {
  hardRules: string[];
  identity: string;
  expression: string[];
  decisions: string[];
  interpersonal: string;
  corrections: string[];
}

/** Training-export compatible persona (BankExpertTrainer). */
export interface Persona {
  identity: string;
  expression: string[];
  heuristics: string[];
  interpersonal: string;
  antiPatterns: string[];
  limits: string[];
  layers?: PersonaLayers;
}

/** Interaction dimension → persona expression / heuristics / interpersonal. */
export interface InteractionDimension {
  expression: string[];
  heuristics: string[];
  interpersonal: string;
}

/** Memory dimension: refs only; never embed raw PII text. */
export interface MemoryDimension {
  refs: string[];
  notes?: string[];
}

/** Personality dimension → persona identity / antiPatterns / limits. */
export interface PersonalityDimension {
  identity: string;
  antiPatterns: string[];
  limits: string[];
  /** Distilly six-layer persona when colleague/known subject. */
  layers?: PersonaLayers;
}

/**
 * Four-dimension extract bundle.
 * Procedure maps to WorkSkill; interaction+personality merge into Persona on export.
 */
export interface DimensionBundle {
  procedure: WorkSkill;
  interaction: InteractionDimension;
  memory: MemoryDimension;
  personality: PersonalityDimension;
}

export interface EvidenceItem {
  id: string;
  level: EvidenceLevel;
  claim: string;
  quote?: string;
  sourceRef?: string;
  chunkId?: string;
}

export interface DistillRun {
  id: string;
  subjectId: string;
  materialIds: string[];
  phase: DistillPhase;
  dimensions?: DimensionBundle;
  evidence?: EvidenceItem[];
  adapter: AdapterKind;
  status: RunStatus;
  error?: string;
  updatedAt: string;
  createdAt: string;
}

export interface PackageRecord {
  id: string;
  subjectId: string;
  version: number;
  openPersonaPath: string;
  trainingSkillPath: string;
  publishedAt: string;
  synthetic: boolean;
  qualityScore?: number;
  subjectName?: string;
  slug?: string;
}

export interface Correction {
  id: string;
  packageId: string;
  scene: string;
  wrong: string;
  right: string;
  at: string;
}

export interface LlmSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface FeishuSettings {
  appId: string;
  appSecret: string;
}

export interface AppSettings {
  adapter: AdapterKind;
  llm?: LlmSettings;
  feishu?: FeishuSettings;
}

export interface Database {
  subjects: Subject[];
  materials: Material[];
  runs: DistillRun[];
  packages: PackageRecord[];
  corrections: Correction[];
  settings: AppSettings;
}
