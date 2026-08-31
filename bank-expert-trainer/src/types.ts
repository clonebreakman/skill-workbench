export type MaterialKind = "transcript" | "script" | "case" | "policy";
export type Sensitivity = "synthetic" | "redacted" | "raw";
export type EvidenceLevel = "L1" | "L2" | "L3" | "L4";
export type JobStatus = "pending" | "running" | "draft" | "reviewed" | "failed";

export interface Employee {
  id: string;
  slug: string;
  name: string;
  title: string;
  branch: string;
  synthetic: true;
  createdAt: string;
}

export interface Material {
  id: string;
  employeeId: string;
  kind: MaterialKind;
  title: string;
  sensitivity: Sensitivity;
  fileName: string;
  createdAt: string;
}

export interface TextChunk {
  id: string;
  materialId: string;
  employeeId: string;
  text: string;
  index: number;
}

export interface EvidenceItem {
  id: string;
  chunkId: string;
  level: EvidenceLevel;
  claim: string;
  quote: string;
}

export interface WorkSkill {
  scope: string;
  workflows: string[];
  decisionRules: string[];
  forbidden: string[];
  knowledgeRefs: string[];
}

export interface Persona {
  identity: string;
  expression: string[];
  heuristics: string[];
  interpersonal: string;
  antiPatterns: string[];
  limits: string[];
}

export interface DistillDraft {
  workSkill: WorkSkill;
  persona: Persona;
  evidence: EvidenceItem[];
}

export interface DistillJob {
  id: string;
  employeeId: string;
  materialIds: string[];
  status: JobStatus;
  draft?: DistillDraft;
  error?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishedSkill {
  id: string;
  employeeId: string;
  version: number;
  slug: string;
  workSkill: WorkSkill;
  persona: Persona;
  evidence: EvidenceItem[];
  publishedAt: string;
  synthetic: true;
  dirPath: string;
  /** Distill Studio package id from meta.json (for feedback/corrections). */
  sourcePackageId?: string;
}

export type ScenarioCategory = "inquiry" | "identity" | "complaint";

export interface TrainingScenario {
  id: string;
  title: string;
  category: ScenarioCategory;
  difficulty: "easy" | "medium" | "hard";
  customerGoal: string;
  openingLine: string;
  pressureHints: string[];
  successSignals: string[];
  failSignals: string[];
  synthetic: true;
}

export interface TrainingTurn {
  role: "customer" | "trainee";
  text: string;
  at: string;
}

export interface DimensionScore {
  empathy: number;
  compliance: number;
  accuracy: number;
  overall: number;
  notes: string[];
  /** Scenario success signals that were matched. */
  matchedSuccess?: string[];
  /** Scenario fail signals that were matched. */
  matchedFail?: string[];
  /** Short coaching tips derived from gaps. */
  tips?: string[];
}

export interface TrainingSession {
  id: string;
  traineeId: string;
  skillId: string;
  scenarioId: string;
  status: "active" | "completed";
  turns: TrainingTurn[];
  score?: DimensionScore;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Database {
  employees: Employee[];
  materials: Material[];
  jobs: DistillJob[];
  skills: PublishedSkill[];
  sessions: TrainingSession[];
}
