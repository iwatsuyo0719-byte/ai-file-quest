// ステージ定義（stage.json）・正答（answer.json）・採点の型。DESIGN.md §3

export type StageId = "stage01" | "stage02" | "stage03";

export type FillSlot = {
  id: string;
  label: string;
  /** text＝自由入力、select＝options から選ぶ、file＝WORKSPACE のファイル一覧から選ぶ */
  input: "text" | "select" | "file";
  options?: string[];
  suffix?: string;
  placeholder?: string;
  /** 根拠プルダウンを出すか */
  evidence: boolean;
};

export type FillForm = { slots: FillSlot[] };

export type CardForm = {
  rows: number;
  columns: [string, string];
  labelCards: string[];
  candidateCards: string[];
};

export type Stage = {
  id: StageId;
  number: number;
  title: string;
  request: string;
  baseDate: string;
  conditions: string[];
  answerMode: "fill" | "cards";
  form: FillForm | CardForm;
  hints: [string, string, string];
  /** ヒントn段目を開いた時の減点（1段目, 2段目, 3段目） */
  hintPenalties: [number, number, number];
  requiredFiles: string[];
  usefulFiles: string[];
};

export type Normalize = "number" | "text" | "percent";

export type SlotKey = {
  label: string;
  accept: string[];
  normalize: Normalize;
  /** false の時は正確性40点の対象外（ルールでだけ評価する） */
  accuracy?: boolean;
};

export type RuleCheck =
  | { type: "slotAccepted"; slot: string }
  | { type: "slotNotIn"; slot: string; values: string[]; normalize: Normalize }
  | { type: "viewed"; file: string }
  | { type: "decimals"; slot: string; digits: number }
  | { type: "rowOrder"; order: string[] }
  | { type: "fabricatedNumber" }
  | { type: "all"; checks: RuleCheck[] };

export type AnswerKey = {
  slots: Record<string, SlotKey>;
  /** カード配置：ラベルカードの文字 → スロットID */
  labelSlots?: Record<string, string>;
  requiredEvidence: { slot: string; file: string; line: number }[];
  rules: { id: string; desc: string; check: RuleCheck }[];
  fatal: { id: string; desc: string; check: RuleCheck }[];
  explanation: string;
};

export type LineRef = { file: string; line: number };

export type Answer = { value: string; evidence: LineRef | null };

/** 採点に渡す提出内容。UIの状態から作る */
export type Submission = {
  answers: Record<string, Answer>;
  /** カード配置のみ：各行に置かれたラベルのスロットID（ダミー・空欄は null） */
  rowOrder: (string | null)[] | null;
  filled: number;
  total: number;
  /** ファイルを開いた順の履歴 */
  history: string[];
  hintsUsed: number;
};

export type Rank = "S" | "A" | "B" | "C" | "—";

export type ScoreResult = {
  accuracy: number;
  coverage: number;
  evidenceScore: number;
  ruleScore: number;
  compliance: number;
  efficiency: number;
  hintPenalty: number;
  total: number;
  rank: Rank;
  cleared: boolean;
  fatal: { id: string; desc: string }[];
  slots: { slot: string; label: string; correct: boolean; scored: boolean }[];
  evidence: { slot: string; label: string; ok: boolean }[];
  rules: { id: string; desc: string; ok: boolean }[];
  unneededFiles: string[];
  repeatedFiles: { file: string; views: number; penalty: number }[];
};
