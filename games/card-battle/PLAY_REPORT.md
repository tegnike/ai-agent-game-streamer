# カードバトル agent-browserプレイレポート

## 概要

agent-browserを使用してカードバトルゲームを自動プレイした際の操作上の課題と改善提案をまとめる。

- 難易度: Normal
- 結果: プレイヤー 3勝 - CPU 1勝（4ラウンドで決着）
- 使用API: `playCard()`, `getGameState()`, `getValidMoves()`, `isReady()`

---

## 1. フェーズ待機の不安定さ

### 問題

カードをプレイした後、バトル演出（CPU思考 → カード公開 → 衝突アニメーション → 結果表示）が完了するまで次の操作ができない。今回のプレイでは `sleep 3` で固定時間待機したが、以下のリスクがある。

- アニメーション時間が状況によって変動する場合、待機不足でAPIコールが失敗する
- 逆に過剰に待機すると、プレイ全体が不必要に遅くなる

### 実際に使用したコード

```bash
# 固定3秒待機（不安定）
agent-browser eval "game.playCard(0)"
sleep 3
agent-browser eval "JSON.stringify(game.getGameState())"
```

### 推奨されるコード

```bash
# isReady()によるフェーズ待機（安定）
agent-browser eval "game.playCard(0)"
agent-browser wait --fn "game.isReady() || game.getGameState().gameOver"
agent-browser eval "JSON.stringify(game.getGameState())"
```

### 備考

READMEには `agent-browser wait --fn "game.isReady()"` の記載がある。ただし `isReady()` は「select phaseかつゲーム未終了」で `true` を返すため、最終ラウンド（ゲーム終了時）には `false` のまま待機が終わらない可能性がある。`game.getGameState().gameOver` との OR 条件が必要。

### 提案

READMEのラウンドループ例を以下のように修正すると、最終ラウンドでのハングを防げる。

```bash
# 修正版: gameOver条件を含む
agent-browser wait --fn "game.isReady() || game.getGameState().gameOver"
```

---

## 2. ラウンド結果の取得が煩雑

### 問題

直前のラウンド結果を確認するには、`getGameState().roundHistory` 配列の末尾を自分で参照する必要がある。毎ラウンド巨大なJSON全体を取得・パースすることになり、agent側の処理負荷とコンテキスト消費が大きい。

### 現状のコード

```javascript
// 全状態を取得して末尾から結果を抽出
const state = game.getGameState();
const lastRound = state.roundHistory[state.roundHistory.length - 1];
// lastRound.winner, lastRound.reversal, etc.
```

### 提案: `getLastRoundResult()` APIの追加

```javascript
game.getLastRoundResult()
// 戻り値: {
//   round: 4,
//   playerCard: {element: "light", power: 10, name: "光10"},
//   cpuCard: {element: "dark", power: 10, name: "闇10"},
//   playerPower: 10,
//   cpuPower: 11,
//   winner: "player",
//   reversal: true,
//   playerBreakdown: [...],
//   cpuBreakdown: [...]
// }
// ラウンド未実施時は null
```

これにより、1回のevalコールで直前の結果だけを軽量に取得できる。

---

## 3. 使用済みカード情報の集計APIがない

### 問題

カードカウンティング（CPUの残り手札の推測）は有効な戦略だが、使用済みカードの一覧を得るにはroundHistoryを毎回ループして集計する必要がある。

### 現状のコード

```javascript
const history = game.getGameState().roundHistory;
const usedByPlayer = history.map(h => h.playerCard);
const usedByCpu = history.map(h => h.cpuCard);
```

### 提案: `getUsedCards()` APIの追加

```javascript
game.getUsedCards()
// 戻り値: {
//   player: [
//     {element: "fire", power: 8, name: "火8"},
//     {element: "light", power: 2, name: "光2"},
//     ...
//   ],
//   cpu: [
//     {element: "dark", power: 6, name: "闇6"},
//     {element: "grass", power: 10, name: "草10"},
//     ...
//   ]
// }
```

---

## 4. パワー反転の事前判断材料がない

### 問題

光 vs 闇のパワー反転ルールは勝敗を大きく左右する（今回のラウンド4で実際に決め手になった）。しかしカード選択時に `getValidMoves()` からは反転リスクの情報が得られず、戦略判断が難しい。

### 現状の `getValidMoves()` 出力

```javascript
{index: 2, card: {element: "light", power: 10}, chainBonus: 0, isChainElement: true}
```

### 提案: 反転リスク情報の付加

```javascript
{
  index: 2,
  card: {element: "light", power: 10},
  chainBonus: 0,
  isChainElement: true,
  reversalPossible: true  // 光or闇のカードは反転の可能性あり
}
```

CPUの手は見えないため確定情報にはならないが、「このカードを出すと反転が起き得る」というフラグがあるだけで戦略の指標になる。

---

## 5. 良かった点（現状で十分機能している部分）

| API / 機能 | 評価 |
|-----------|------|
| `playCard(index)` | シンプルで直感的。戻り値booleanでエラー判定も明確 |
| `isReady()` | フェーズ判定に有用（gameOver条件の補完が必要） |
| `getValidMoves()` の `isChainElement` | チェイン戦略の判断に不可欠。非常に便利 |
| `getGameState()` | 全情報が取得できる網羅性は十分 |
| `getValidMoves()` の `chainBonus` | 現在のボーナス値が事前にわかるので計算不要 |

---

## 改善提案の優先度

| 優先度 | 提案 | 理由 |
|--------|------|------|
| **高** | `isReady()` のgameOver対応（またはREADME修正） | 最終ラウンドでハングする実害がある |
| **中** | `getLastRoundResult()` の追加 | 毎ラウンドのコンテキスト消費を削減 |
| **低** | `getUsedCards()` の追加 | 便利だがroundHistoryから代替可能 |
| **低** | `reversalPossible` フラグの追加 | 属性を見れば判断可能だが、あると親切 |
