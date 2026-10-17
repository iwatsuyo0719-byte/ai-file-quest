# AI FILE QUEST

プレイヤー自身がAIエージェントになり、仮想フォルダのファイルを探して読み、指示を守って成果物を提出するブラウザゲーム。

- 要件：[docs/REQUIREMENTS_v1.0.md](docs/REQUIREMENTS_v1.0.md)（Ver.1.0 FIX）
- 詳細設計：[docs/DESIGN.md](docs/DESIGN.md)（Ver.1.1、2026-10-17承認。§11 に Ver.1.2 差分＝承認待ち）
- 実装：Claude Code（Opus 5.5）。Codexへは委譲しない
- 状態：MVP（Stage 1〜3）実装済み。GitHub Pages 公開は未設定

## 動かし方

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 採点・保存・ツリー・ステージデータのテスト
npm run build    # dist/ に静的ファイルを出力
```

画面幅 1280px 以上のPCブラウザ（Chrome / Edge 最新）向け。

## 構成

- `src/` … `main.ts`（画面切替）、`state.ts`（ステージ内の一時状態）、`scoring.ts`（採点・純関数）、`save.ts`（localStorage）、`vfs.ts`（仮想ファイルツリー）、`ui/`（描画）
- `stages/stageNN/` … `files/`（プレイヤーに見える本文）、`stage.json`（依頼・設定）、`answer.json`（正答・採点。採点時にだけ読み込む）
- `tests/` … Vitest

## 2026-10-17 承認時に確定した事項
- 設計書の「案」の数値はすべてそのまま確定（テストプレイ後に調整）
- Google Fonts（Material Symbols Outlined・日本語フォント）を使用する
- repoはPublic（GitHub Pagesで公開）
