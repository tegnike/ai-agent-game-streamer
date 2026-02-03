# レビュー: 配信プラットフォーム拡張計画

**対象**: `goofy-toasting-sedgewick.md` (AI Agent Game Streamer - 配信プラットフォーム拡張計画)
**レビュー日**: 2026-02-03
**総合評価**: B+ (よくできているが、いくつか要修正点あり)

---

## 良い点

### フェーズ分割の依存関係が正しい

Phase 1のEvent Hubが全ての土台になり、Phase 4が最も独立性が高いという整理は理にかなっている。実装順序の根拠が明確。

### 既存アーキテクチャとの整合性

既存の `GameOrchestrator` → `SessionManager` → `EventMonitor` のコンポジション構造を壊さずに `EventHub` を注入する設計。現行コードのパターンをよく理解した上での拡張になっている。

### WebSocketプロトコルの型定義が具体的

- `state:full` でフルスナップショット送信
- `state:update` で差分更新
- `agent:activity:delta` でストリーミングテキスト

実装者が迷わないレベルの具体性がある。

### REST API設計の一貫性

`/api/stream/start|stop|pause|resume` と `/api/game/skip` の分離がRESTfulで一貫している。

---

## 要修正点・懸念事項

### 1. ポート競合の未整理（重要度: 高）

現行のポート利用状況:

| 用途 | ポート |
|------|--------|
| ゲームサーバー | 8888 |
| OpenCodeサーバー | 4096 |
| Stream Server（新規） | 3000 |
| React devサーバー（新規） | 5173 |

`process-manager.ts` の `killPort()` が管理外のポートに触れないよう、管理対象ポートの明示的な一覧定義が必要。

また `config.ts` に `STREAM_SERVER_PORT = 3000` を追加する計画だが、環境変数や `opencode.json` からの読み込みパスについて言及がない。`--admin-port` CLIフラグだけでは不十分。

### 2. `session.promptAsync` の存在確認（重要度: 高）

計画の「管理者→AIエージェント通信」で `client.session.promptAsync` を使用するとあるが、現行コードで `@opencode-ai/sdk` から使われているのは以下のみ:

- `client.session.prompt`（同期的にレスポンスを待つ）
- `client.session.create`
- `client.session.abort`

**`promptAsync` がSDKに実在するか未確認。** 存在しない場合の代替案:

- `prompt()` を別スレッド（Worker）で呼ぶ
- `abort()` + 新規 `prompt()` のパターンでキューイングを自前実装

実装着手前にSDKのAPIドキュメントで検証が必要。

### 3. EventHubのリングバッファサイズ（重要度: 中）

「AgentActivityのリングバッファ（最新200件）」の根拠が不明。

現行の `event-monitor.ts` を基に見積もると:
- 1回のツール実行: `running` → `completed` の2イベント
- テキスト: デルタ単位で大量
- オセロ1ゲーム: 数十手 × (スクリーンショット + eval + テキスト出力)

200件は約1ゲーム分。マルチゲーム配信では不足する可能性がある。

また、Admin UI接続時に200件のActivityを全送信すると初回接続が重い。**ページネーション、または直近N件 + 詳細はREST APIで取得** のパターンを推奨。

### 4. Express導入の妥当性（重要度: 中）

現行プロジェクトの依存は `@opencode-ai/sdk` と `@playwright/test` のみのスリムな構成。

Node.js 18+の `node:http` 組み込みモジュールでREST API + WebSocketは十分対応可能。ビルド済みReactの配信だけなら `sirv` 等の軽量選択肢もある。

**「なぜExpressか」の判断根拠を計画に明記すべき。**

### 5. YouTube APIのレート制限とエラーハンドリング（重要度: 中）

ポーリング周期10秒の数値的裏付け:

- `liveChatMessages.list` = 1回5ユニット消費
- 10秒間隔 = 1時間で360回 = 1,800ユニット
- **YouTube APIの日次クォータ10,000ユニット → 約5.5時間で枯渇**

長時間配信を想定するなら:
- クォータ残量監視
- APIレスポンスの `pollingIntervalMillis` を動的に反映する仕組み
- API障害時・クォータ超過時のリトライ戦略

これらが計画に不足している。

### 6. Visual Bridgeの感情検出（重要度: 低）

キーワードマッチのみの感情検出は精度が低い（例: 「角を取られた！」が `frustrated` か `excited` か判定不能）。

ただしfire-and-forgetの外部送信のため致命的ではない。V1としては許容範囲。将来的にLLMによる感情判定オプションがあるとよい。

### 7. テスト計画の不在（重要度: 中）

現行プロジェクトにテスト・テストスクリプトが一切ない。検証方法が全て手動（`curl`, `wscat`）のみ。

少なくとも Phase 1 の `EventHub` と `StreamManager` には単体テストが必要:
- pub/subの購読・配信テスト
- 状態遷移の正当性テスト

---

## 設計上の提案

### A. StreamManagerの状態遷移図を追加すべき

`StreamPhase` が6状態あるが、許可される遷移が明記されていない。

```
idle → starting → playing → transitioning → playing (loop)
                          → stopped
playing → paused → playing (resume)
                 → stopped
```

不正な遷移（例: `idle` → `paused`）を防ぐステートマシン設計が必要。

### B. admin-uiの技術スタック詳細が薄い

以下の仕様が不足:
- 状態管理手法（Context API / zustand / etc.）
- WebSocket再接続ロジック（再接続間隔、最大リトライ回数）
- 接続断時のUI表示仕様（`[● Connected]` ↔ `[○ Disconnected]`）

### C. グレースフルシャットダウンの考慮

Stream Serverが落ちた時、進行中のゲームセッションが孤立するリスクがある。現行の `game-orchestrator.ts` には `process.on('SIGINT')` / `process.on('SIGTERM')` のハンドラがない。拡張計画にクリーンアップの仕組みを追加すべき。

---

## ファイル変更の影響度マトリクス

| 既存ファイル | 変更規模 | リスク | 備考 |
|---|---|---|---|
| `src/event-monitor.ts` | 中 | 低 | EventHub注入は非破壊的 |
| `src/game-orchestrator.ts` | 大 | **中** | `startManagedStream` 追加で複雑度増大 |
| `src/session-manager.ts` | 中 | **高** | `promptAsync` の存在未確認 |
| `src/index.ts` | 小 | 低 | フラグ追加のみ |
| `src/config.ts` | 小 | 低 | 定数追加のみ |

---

## 実装着手前に解決すべき3項目

1. **`session.promptAsync` がSDKに実在するか確認する** — なければ代替設計が必要
2. **StreamManagerの状態遷移図を追加する** — 6状態の遷移ルールを明確化
3. **Phase 1に最低限の単体テスト計画を入れる** — EventHub + StreamManagerのテスト

上記3点が解消されれば、Phase 1から着手して問題ないレベルと判断する。YouTube APIのクォータ計算も配信時間の想定と合わせて確認しておくことを推奨。
