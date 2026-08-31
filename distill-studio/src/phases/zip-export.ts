import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Zip a training-skill directory to `{dir}.zip` (Windows Compress-Archive). */
export async function zipTrainingSkillDir(trainingSkillPath: string): Promise<string> {
  await access(trainingSkillPath);
  const zipPath = `${trainingSkillPath}.zip`;
  if (process.platform === "win32") {
    const ps = `Compress-Archive -Path (Join-Path '${trainingSkillPath.replace(/'/g, "''")}' '*') -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`;
    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", ps]);
  } else {
    await execFileAsync("zip", ["-r", "-q", zipPath, "."], { cwd: trainingSkillPath });
  }
  return zipPath;
}
