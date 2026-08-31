import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { AppStore } from "../store.js";
import type {
  DimensionBundle,
  EvidenceItem,
  PackageRecord,
  Persona,
} from "../types.js";
import { scoreDistillQuality } from "./quality.js";

function shortId(prefix: string): string {
  return `${prefix}${randomUUID().slice(0, 8)}`;
}

function toPersona(dimensions: DimensionBundle): Persona {
  return {
    identity: dimensions.personality.identity,
    expression: dimensions.interaction.expression,
    heuristics: dimensions.interaction.heuristics,
    interpersonal: dimensions.interaction.interpersonal,
    antiPatterns: dimensions.personality.antiPatterns,
    limits: dimensions.personality.limits,
    layers: dimensions.personality.layers,
  };
}

function skillMarkdown(
  slug: string,
  persona: Persona,
  procedure: DimensionBundle["procedure"],
): string {
  const layers = persona.layers;
  const layerBlock = layers
    ? `
# Persona Layers (Distilly)

## Layer 0 — Hard Rules
${layers.hardRules.map((x) => `- ${x}`).join("\n") || "- (none)"}

## Layer 1 — Identity
${layers.identity}

## Layer 2 — Expression
${layers.expression.map((x) => `- ${x}`).join("\n") || "- (none)"}

## Layer 3 — Decisions
${layers.decisions.map((x) => `- ${x}`).join("\n") || "- (none)"}

## Layer 4 — Interpersonal
${layers.interpersonal || "(none)"}

## Layer 5 — Corrections
${layers.corrections.map((x) => `- ${x}`).join("\n") || "- (awaiting evolve)"}
`
    : "";

  return `---
name: ${slug}
description: Distilled colleague skill for ${slug} (Work + 6-layer Persona)
---

# PART A — Work Skill

- **scope:** ${procedure.scope}
- **workflows:**
${procedure.workflows.map((x) => `  - ${x}`).join("\n") || "  - (none)"}
- **decisionRules:**
${procedure.decisionRules.map((x) => `  - ${x}`).join("\n") || "  - (none)"}
- **forbidden:**
${procedure.forbidden.map((x) => `  - ${x}`).join("\n") || "  - (none)"}
- **outputPreferences:**
${(procedure.outputPreferences ?? []).map((x) => `  - ${x}`).join("\n") || "  - (none)"}
- **experienceNotes:**
${(procedure.experienceNotes ?? []).map((x) => `  - ${x}`).join("\n") || "  - (none)"}

# PART B — Persona (flat)

- **identity:** ${persona.identity}
- **expression:** ${persona.expression.join("; ")}
- **heuristics:** ${persona.heuristics.join("; ")}
- **interpersonal:** ${persona.interpersonal}
- **antiPatterns:** ${persona.antiPatterns.join("; ")}
- **limits:** ${persona.limits.join("; ")}
${layerBlock}
# Runtime

1. Apply Persona hard rules and interpersonal posture first.
2. Execute with Work Skill workflows and decision rules.
3. Never violate forbidden / antiPatterns.
`;
}

export async function exportPackages(
  store: AppStore,
  opts: {
    subjectId: string;
    version: number;
    dimensions: DimensionBundle;
    evidence: EvidenceItem[];
  },
): Promise<{ openPersonaPath: string; trainingSkillPath: string; package: PackageRecord }> {
  const subject = await store.getSubject(opts.subjectId);
  if (!subject) {
    throw new Error("SUBJECT_NOT_FOUND");
  }

  const folder = `${subject.slug}-v${opts.version}`;
  const trainingSkillPath = join(store.exportsDir, "training-skill", folder);
  const openPersonaPath = join(store.exportsDir, "openpersona", folder);

  await mkdir(trainingSkillPath, { recursive: true });
  await mkdir(join(openPersonaPath, "soul"), { recursive: true });

  const persona = toPersona(opts.dimensions);
  const quality = scoreDistillQuality(opts.dimensions);
  const meta = {
    source: "distill-studio",
    subjectType: subject.type,
    version: opts.version,
    synthetic: true,
    slug: subject.slug,
    name: subject.name,
    subjectId: subject.id,
    quality,
  };

  const md = skillMarkdown(subject.slug, persona, opts.dimensions.procedure);

  await writeFile(join(trainingSkillPath, "SKILL.md"), md, "utf8");
  await writeFile(
    join(trainingSkillPath, "work-skill.json"),
    JSON.stringify(opts.dimensions.procedure, null, 2),
    "utf8",
  );
  await writeFile(
    join(trainingSkillPath, "persona.json"),
    JSON.stringify(persona, null, 2),
    "utf8",
  );
  await writeFile(
    join(trainingSkillPath, "evidence.jsonl"),
    opts.evidence.map((e) => JSON.stringify(e)).join("\n") + (opts.evidence.length ? "\n" : ""),
    "utf8",
  );
  await writeFile(
    join(trainingSkillPath, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8",
  );

  await writeFile(join(openPersonaPath, "SKILL.md"), md, "utf8");
  await writeFile(
    join(openPersonaPath, "persona.json"),
    JSON.stringify(persona, null, 2),
    "utf8",
  );
  await writeFile(
    join(openPersonaPath, "state.json"),
    JSON.stringify({ status: "ready", version: opts.version, quality }, null, 2),
    "utf8",
  );
  const hard = persona.layers?.hardRules?.join("\n- ") ?? "";
  await writeFile(
    join(openPersonaPath, "soul", "injection.md"),
    `# Injection\n\nYou are ${persona.identity}.\n\nHard rules:\n- ${hard || "comply with bank policy"}\n`,
    "utf8",
  );
  await writeFile(
    join(openPersonaPath, "soul", "constitution.md"),
    `# Constitution\n\nLimits: ${persona.limits.join("; ")}\nAntiPatterns: ${persona.antiPatterns.join("; ")}\n`,
    "utf8",
  );
  await writeFile(
    join(openPersonaPath, "agent-card.json"),
    JSON.stringify(
      {
        name: subject.name,
        slug: subject.slug,
        identity: persona.identity,
        qualityScore: quality.score,
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    join(openPersonaPath, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf8",
  );

  const pkg: PackageRecord = {
    id: shortId("PKG-"),
    subjectId: subject.id,
    version: opts.version,
    openPersonaPath,
    trainingSkillPath,
    publishedAt: new Date().toISOString(),
    synthetic: true,
    qualityScore: quality.score,
    subjectName: subject.name,
    slug: subject.slug,
  };
  await store.addPackage(pkg);

  const metaWithId = { ...meta, packageId: pkg.id };
  await writeFile(join(trainingSkillPath, "meta.json"), JSON.stringify(metaWithId, null, 2), "utf8");
  await writeFile(join(openPersonaPath, "meta.json"), JSON.stringify(metaWithId, null, 2), "utf8");

  return { openPersonaPath, trainingSkillPath, package: pkg };
}
