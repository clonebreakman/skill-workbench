import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, posix } from "node:path";
import type {
  AppSettings,
  Correction,
  Database,
  DistillRun,
  Material,
  MaterialKind,
  PackageRecord,
  Sensitivity,
  Subject,
  SubjectProfile,
  SubjectType,
} from "./types.js";

const emptyDb = (): Database => ({
  subjects: [],
  materials: [],
  runs: [],
  packages: [],
  corrections: [],
  settings: { adapter: "mock" },
});

function shortId(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`;
}

function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function assertSafeFileName(fileName: string): void {
  if (
    !fileName ||
    fileName.includes("..") ||
    isAbsolute(fileName) ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    throw new Error("INVALID_FILENAME");
  }
}

export class AppStore {
  readonly rootDir: string;
  readonly dataDir: string;
  readonly knowledgeDir: string;
  readonly exportsDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.dataDir = join(rootDir, "data");
    this.knowledgeDir = join(rootDir, "knowledge");
    this.exportsDir = join(rootDir, "exports");
  }

  get dbPath(): string {
    return join(this.dataDir, "db.json");
  }

  async init(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    await mkdir(this.knowledgeDir, { recursive: true });
    await mkdir(join(this.exportsDir, "openpersona"), { recursive: true });
    await mkdir(join(this.exportsDir, "training-skill"), { recursive: true });
    try {
      await readFile(this.dbPath, "utf8");
    } catch {
      await this.save(emptyDb());
    }
  }

  async load(): Promise<Database> {
    const raw = await readFile(this.dbPath, "utf8");
    return JSON.parse(raw) as Database;
  }

  async save(db: Database): Promise<void> {
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async createSubject(input: {
    slug: string;
    name: string;
    type: SubjectType;
    profile: SubjectProfile;
  }): Promise<Subject> {
    const db = await this.load();
    const subject: Subject = {
      id: shortId("SUB-"),
      slug: input.slug,
      name: input.name,
      type: input.type,
      profile: input.profile,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    db.subjects.push(subject);
    await this.save(db);
    return subject;
  }

  async getSubject(id: string): Promise<Subject | undefined> {
    const db = await this.load();
    return db.subjects.find((s) => s.id === id);
  }

  async listSubjects(): Promise<Subject[]> {
    return (await this.load()).subjects;
  }

  async updateSubject(
    id: string,
    patch: Partial<Omit<Subject, "id" | "createdAt">>,
  ): Promise<Subject> {
    const db = await this.load();
    const index = db.subjects.findIndex((s) => s.id === id);
    if (index < 0) {
      throw new Error("SUBJECT_NOT_FOUND");
    }
    const updated: Subject = { ...db.subjects[index]!, ...patch, id };
    db.subjects[index] = updated;
    await this.save(db);
    return updated;
  }

  async addMaterial(input: {
    subjectId: string;
    kind: MaterialKind;
    title: string;
    sensitivity: Sensitivity;
    fileName: string;
    content: string;
  }): Promise<Material> {
    assertSafeFileName(input.fileName);
    const db = await this.load();
    if (!db.subjects.some((s) => s.id === input.subjectId)) {
      throw new Error("SUBJECT_NOT_FOUND");
    }
    const subjectDir = join(this.knowledgeDir, input.subjectId);
    await mkdir(subjectDir, { recursive: true });
    const absPath = join(subjectDir, input.fileName);
    await writeFile(absPath, input.content, "utf8");
    const relativePath = posix.join(input.subjectId, input.fileName);
    const material: Material = {
      id: shortId("MAT-"),
      subjectId: input.subjectId,
      kind: input.kind,
      title: input.title,
      sensitivity: input.sensitivity,
      fileName: input.fileName,
      path: relativePath,
      hash: sha256(input.content),
      createdAt: new Date().toISOString(),
    };
    db.materials.push(material);
    await this.save(db);
    return material;
  }

  async listMaterials(subjectId: string): Promise<Material[]> {
    const db = await this.load();
    return db.materials.filter((m) => m.subjectId === subjectId);
  }

  async readMaterialContent(materialId: string): Promise<string> {
    const db = await this.load();
    const material = db.materials.find((m) => m.id === materialId);
    if (!material) {
      throw new Error("MATERIAL_NOT_FOUND");
    }
    return readFile(join(this.knowledgeDir, material.path), "utf8");
  }

  async upsertRun(run: DistillRun): Promise<void> {
    const db = await this.load();
    const index = db.runs.findIndex((r) => r.id === run.id);
    if (index >= 0) {
      db.runs[index] = run;
    } else {
      db.runs.push(run);
    }
    await this.save(db);
  }

  async getRun(id: string): Promise<DistillRun | undefined> {
    const db = await this.load();
    return db.runs.find((r) => r.id === id);
  }

  async addPackage(pkg: PackageRecord): Promise<void> {
    const db = await this.load();
    db.packages.push(pkg);
    await this.save(db);
  }

  async listPackages(subjectId?: string): Promise<PackageRecord[]> {
    const db = await this.load();
    if (subjectId === undefined) {
      return db.packages;
    }
    return db.packages.filter((p) => p.subjectId === subjectId);
  }

  async getPackage(id: string): Promise<PackageRecord | undefined> {
    const db = await this.load();
    return db.packages.find((p) => p.id === id);
  }

  async removePackages(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const drop = new Set(ids);
    const db = await this.load();
    const before = db.packages.length;
    db.packages = db.packages.filter((p) => !drop.has(p.id));
    db.corrections = db.corrections.filter((c) => !drop.has(c.packageId));
    await this.save(db);
    return before - db.packages.length;
  }

  async addCorrection(correction: Correction): Promise<void> {
    const db = await this.load();
    db.corrections.push(correction);
    await this.save(db);
  }

  async listCorrections(packageId: string): Promise<Correction[]> {
    const db = await this.load();
    return db.corrections.filter((c) => c.packageId === packageId);
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const db = await this.load();
    db.settings = {
      ...db.settings,
      ...patch,
      llm: patch.llm !== undefined ? patch.llm : db.settings.llm,
      feishu: patch.feishu !== undefined ? patch.feishu : db.settings.feishu,
    };
    await this.save(db);
    return db.settings;
  }
}
