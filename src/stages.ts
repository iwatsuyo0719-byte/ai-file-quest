// ステージデータの読み込み。answer.json は採点時にだけ動的に読む（DESIGN.md §2）
import type { AnswerKey, Stage, StageId } from "./types";

const stageJson = import.meta.glob<Stage>("/stages/*/stage.json", { eager: true, import: "default" });
const rawFiles = import.meta.glob<string>("/stages/*/files/**/*", {
  eager: true,
  query: "?raw",
  import: "default",
});
const answerJson = import.meta.glob<AnswerKey>("/stages/*/answer.json", { import: "default" });

export const STAGES: Stage[] = Object.values(stageJson).sort((a, b) => a.number - b.number);
export const STAGE_ORDER: StageId[] = STAGES.map((s) => s.id);

export function getStage(id: StageId): Stage {
  const s = STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown stage: ${id}`);
  return s;
}

/** WORKSPACE からの相対パス → 本文 */
export function getFiles(id: StageId): Record<string, string> {
  const prefix = `/stages/${id}/files/`;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawFiles)) {
    if (k.startsWith(prefix)) out[k.slice(prefix.length)] = v;
  }
  return out;
}

export async function loadAnswerKey(id: StageId): Promise<AnswerKey> {
  const load = answerJson[`/stages/${id}/answer.json`];
  if (!load) throw new Error(`answer key not found: ${id}`);
  return load();
}

export function nextStage(id: StageId): StageId | null {
  const i = STAGE_ORDER.indexOf(id);
  return STAGE_ORDER[i + 1] ?? null;
}
