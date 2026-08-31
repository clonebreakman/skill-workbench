import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  Database,
  DistillJob,
  Employee,
  Material,
  PublishedSkill,
  TrainingSession,
} from "./types.js";

const emptyDb = (): Database => ({
  employees: [],
  materials: [],
  jobs: [],
  skills: [],
  sessions: [],
});

export class AppStore {
  constructor(private readonly rootDir: string) {}

  get dbPath(): string {
    return join(this.rootDir, "db.json");
  }

  get materialsDir(): string {
    return join(this.rootDir, "materials");
  }

  get skillsDir(): string {
    return join(this.rootDir, "skills");
  }

  async init(): Promise<void> {
    await mkdir(this.materialsDir, { recursive: true });
    await mkdir(this.skillsDir, { recursive: true });
    await mkdir(dirname(this.dbPath), { recursive: true });
    try {
      await readFile(this.dbPath, "utf8");
    } catch {
      await this.save(emptyDb());
    }
  }

  async load(): Promise<Database> {
    const raw = await readFile(this.dbPath, "utf8");
    const parsed = JSON.parse(raw) as Database;
    if (!Array.isArray(parsed.sessions)) {
      parsed.sessions = [];
    }
    return parsed;
  }

  async save(db: Database): Promise<void> {
    await writeFile(this.dbPath, JSON.stringify(db, null, 2), "utf8");
  }

  async createEmployee(input: {
    name: string;
    title: string;
    branch: string;
    slug?: string;
  }): Promise<Employee> {
    const db = await this.load();
    const derived =
      input.name
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
        .replace(/^-|-$/g, "") || `teller-${randomUUID().slice(0, 8)}`;
    const slug = input.slug ?? derived;
    const employee: Employee = {
      id: `EMP-${randomUUID().slice(0, 8)}`,
      slug,
      name: input.name,
      title: input.title,
      branch: input.branch,
      synthetic: true,
      createdAt: new Date().toISOString(),
    };
    db.employees.push(employee);
    await this.save(db);
    return employee;
  }

  async addMaterial(input: {
    employeeId: string;
    kind: Material["kind"];
    title: string;
    sensitivity: Material["sensitivity"];
    fileName: string;
    content: string;
  }): Promise<Material> {
    if (!input.content.trim()) {
      throw new Error("EMPTY_MATERIAL");
    }
    if (input.sensitivity === "raw") {
      throw new Error("RAW_MATERIAL_NOT_ALLOWED");
    }
    const db = await this.load();
    if (!db.employees.some((e) => e.id === input.employeeId)) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }
    const id = `MAT-${randomUUID().slice(0, 8)}`;
    const storedName = `${id}.md`;
    await writeFile(join(this.materialsDir, storedName), input.content, "utf8");
    const material: Material = {
      id,
      employeeId: input.employeeId,
      kind: input.kind,
      title: input.title,
      sensitivity: input.sensitivity,
      fileName: storedName,
      createdAt: new Date().toISOString(),
    };
    db.materials.push(material);
    await this.save(db);
    return material;
  }

  async readMaterialContent(material: Material): Promise<string> {
    return readFile(join(this.materialsDir, material.fileName), "utf8");
  }

  async upsertJob(job: DistillJob): Promise<void> {
    const db = await this.load();
    const index = db.jobs.findIndex((item) => item.id === job.id);
    if (index >= 0) {
      db.jobs[index] = job;
    } else {
      db.jobs.push(job);
    }
    await this.save(db);
  }

  async getJob(id: string): Promise<DistillJob | undefined> {
    const db = await this.load();
    return db.jobs.find((job) => job.id === id);
  }

  async addSkill(skill: PublishedSkill): Promise<void> {
    const db = await this.load();
    db.skills.push(skill);
    await this.save(db);
  }

  async listSkills(): Promise<PublishedSkill[]> {
    return (await this.load()).skills;
  }

  async getLatestSkill(employeeId: string): Promise<PublishedSkill | undefined> {
    const skills = (await this.load()).skills
      .filter((skill) => skill.employeeId === employeeId)
      .sort((a, b) => b.version - a.version);
    return skills[0];
  }

  async getSkillById(id: string): Promise<PublishedSkill | undefined> {
    return (await this.load()).skills.find((skill) => skill.id === id);
  }

  async upsertSession(session: TrainingSession): Promise<void> {
    const db = await this.load();
    const index = db.sessions.findIndex((item) => item.id === session.id);
    if (index >= 0) {
      db.sessions[index] = session;
    } else {
      db.sessions.push(session);
    }
    await this.save(db);
  }

  async getSession(id: string): Promise<TrainingSession | undefined> {
    return (await this.load()).sessions.find((session) => session.id === id);
  }

  async listSessions(): Promise<TrainingSession[]> {
    return (await this.load()).sessions;
  }
}
