# カードバトル

5属性の相性・パワー・チェインコンボで勝負するカードバトルゲーム。

## ルール

### カードプール

5属性 × 5段階パワー = 全25種類のカード。

| 属性 | パワー値 |
|------|----------|
| 火(fire) | 2, 4, 6, 8, 10 |
| 水(water) | 2, 4, 6, 8, 10 |
| 草(grass) | 2, 4, 6, 8, 10 |
| 光(light) | 2, 4, 6, 8, 10 |
| 闇(dark) | 2, 4, 6, 8, 10 |

### 属性相性

- **三すくみ**: 火 → 草 → 水 → 火（有利な属性で攻撃すると **+3** パワーボーナス）
- **パワー反転**: 光 ⇔ 闇（光と闇が対戦すると、パワーの **低い方が勝つ**）

### チェインコンボシステム

同じ属性のカードを連続で出すとチェインボーナスが発生する。

| 連続回数 | ボーナス | 特殊効果 |
|---------|---------|---------|
| 2連続 | +1 | - |
| 3連続 | +2 | - |
| 4連続 | +4 | 属性不利を無効化 |

チェインはプレイヤー・CPU各自で独立して管理される。

### サクリファイスシステム

手札のカードを「生贄」として捨て、次にプレイするカードを強化する仕組み。

- カード右上の **⚡ボタン** を押すと、そのカードをサクリファイスできる
- サクリファイス値 = **floor(カードのパワー ÷ 2)**
- サクリファイス値はボーナスとして蓄積され、そのターンにプレイするカードに加算される
- **複数枚のサクリファイスが可能**（ボーナスは累積する）
- 手札が1枚の場合はサクリファイスできない（プレイ用のカードが必要）
- ボーナスはラウンド終了時にリセットされる

| カードパワー | サクリファイス値 |
|-------------|----------------|
| 2 | +1 |
| 4 | +2 |
| 6 | +3 |
| 8 | +4 |
| 10 | +5 |

**コスト**: カードを消費するため、以降のラウンドで手札が減る。弱いカードを燃料にして勝負所で勝ちに行く戦略が有効。

**CPUのサクリファイス行動**:

| 難易度 | サクリファイス対象 | 条件 |
|--------|------------------|------|
| Easy | 使わない | - |
| Normal | パワー2のカードのみ | 手札3枚以上 |
| Hard | パワー4以下のカード | 手札2枚以上 |

### パワー計算

```
最終パワー = 基本パワー + サクリファイスボーナス + 属性有利ボーナス(+3) + チェインボーナス(+1〜+4)
```

- 通常: 最終パワーが **高い方** がラウンド勝利。同値は引き分け。
- 光vs闇: 最終パワーが **低い方** がラウンド勝利（パワー反転）。同値は引き分け。

### CPU手札の属性公開

CPUの手札カードは**属性（アイコン・属性名・属性カラー）が公開**されている。ただし**パワーは「?」で非公開**。

- プレイヤーはCPUの手札構成（どの属性を何枚持っているか）を見て戦略を立てられる
- パワーが不明なため、属性有利でもパワー差で負ける可能性がある（読み合いの余地）
- 「CPUが火を2枚持っているから草は危険」「残り闇1枚だから反転に備えよう」といった判断が可能

### ゲーム進行

1. 25枚のプールをシャッフルし、交互に1枚ずつ各プレイヤーへ10枚配布（手札5枚 + デッキ5枚）。残り5枚は未使用
2. プレイヤーがCPUの手札属性を参考に手札からカードを1枚選択
3. CPUが思考後にカードを1枚選択（3Dフリップ演出でカード公開）
4. パワー比較 → 衝突アニメーション → 勝敗判定
5. 次ラウンド開始時にデッキからカードを1枚ドロー（デッキが残っている場合）
6. 先に3勝した方が勝利（3点先取制）。カードが尽きた場合はその時点の勝利数で判定

### 難易度

| 難易度 | CPU挙動 | サクリファイス |
|--------|---------|--------------|
| Easy | ほぼランダムにカード選択 | 使わない |
| Normal | 属性相性・終盤戦略を考慮 + ランダム要素あり | パワー2のみ（手札3枚以上時） |
| Hard | 属性相性・終盤戦略・チェイン継続を考慮（精度が高い） | パワー4以下（手札2枚以上時） |

難易度設定はlocalStorageに保存される。

## 演出・UI機能

- **CPU手札属性公開**: CPU手札の属性（アイコン・色・属性名）を表示。パワーは「?」で非公開
- **カード衝突アニメーション**: スライドイン + 勝者グロー / 敗者グレースケール
- **属性パーティクル**: 勝利属性に応じたパーティクルエフェクト（属性ごとに形状・動きが異なる）
- **画面シェイク & フラッシュ**: 勝敗確定時
- **CPUカード3Dフリップ**: CPUのカード公開時に裏→表のフリップ演出
- **CPU思考演出**: CPU手札をハイライトしながら考えている演出
- **サクリファイスボタン**: 手札カード右上の⚡ボタンでカードを生贄にして次のプレイを強化。ボーナス蓄積中は手札上部にインジケータ表示
- **パワー内訳表示**: 基本パワー・サクリファイスボーナス・属性有利・チェインボーナスの計算過程をカードの下に表示
- **チェインインジケータ**: 現在のチェイン状態を常時表示。チェイン3以上でフィールド上に「CHAIN x3!」のポップ演出
- **ラウンド履歴タイムライン**: 各ラウンドの結果を縦並びリスト形式で表示
- **属性相性チャート**: サイドパネルにSVGで相性図を常時表示
- **カード一覧モーダル**: 全25種のカードを閲覧可能
- **背景アンビエント**: 属性色のオーブが浮遊するアニメーション背景 + スキャンラインオーバーレイ
- **効果音**: Web Audio APIによるプロシージャル効果音（カード選択・プレイ・衝突・勝利・敗北・属性ボーナス・フリップ）
- **ミュートボタン**: サウンドON/OFF切替
- **タイトルグラデーション**: タイトルにグラデーションアニメーション + サブタイトル「〜 Element Clash 〜」
- **スコアドット表示**: 勝利数を `●○○ vs ●●○` のドット形式で視覚化（3点先取）
- **デッキ残数・手札枚数**: プレイヤー/CPUエリアに「手札: N / デッキ: N」を表示
- **フィールドプレースホルダー**: カード未配置時に破線枠を表示（プレイヤー側は「カードを選択」テキスト付き）
- **ターン進行インジケータ**: 現在のターン側（プレイヤー or CPU）のエリアがグロウ表示。フェーズラベルも表示
- **カード3Dホバー**: 手札カードにマウスを乗せると位置に応じた3D傾き + 属性カラーグロウ
- **リザルトオーバーレイ**: ゲーム終了時にフルスクリーンオーバーレイで勝敗・戦績サマリー・リプレイボタンを表示

## 起動方法

```bash
cd samples/card-battle
python3 -m http.server 8080
open http://localhost:8080
```

## agent-browser対応API

```javascript
// カードをプレイ（0〜手札枚数-1のインデックス）
game.playCard(index)
// 戻り値: true（成功） / false（失敗: フェーズ違い・インデックス範囲外）

// カードをサクリファイス（0〜手札枚数-1のインデックス）
game.sacrificeCard(index)
// 戻り値: true（成功） / false（失敗: フェーズ違い・手札1枚以下・インデックス範囲外）
// サクリファイス後は手札が減り、ボーナスが蓄積される。続けてplayCard()でカードをプレイする

// カード選択可能か判定（フェーズ待機用）
game.isReady()
// 戻り値: true（select phaseかつゲーム未終了） / false

// 有効な手を取得
game.getValidMoves()
// 戻り値: [{index, card: {name, element, power}, action, chainBonus, isChainElement,
//           reversalPossible, sacrificeBonus, canSacrifice, sacrificeValue}]
// reversalPossible: 光or闇カードの場合true（パワー反転の可能性あり）
// sacrificeBonus: 現在の蓄積サクリファイスボーナス
// canSacrifice: サクリファイス可能か（手札2枚以上で true）
// sacrificeValue: このカードをサクリファイスした場合のボーナス値

// 直前のラウンド結果を取得（軽量）
game.getLastRoundResult()
// 戻り値: {round, playerCard, cpuCard, playerPower, cpuPower, winner, reversal, playerBreakdown, cpuBreakdown}
// ラウンド未実施時は null

// 使用済みカード一覧を取得（カードカウンティング用）
game.getUsedCards()
// 戻り値: {player: [{element, power, name}, ...], cpu: [{element, power, name}, ...]}

// ゲーム状態を取得
game.getGameState()
// 戻り値: {
//   phase,           // 'select' | 'battle' | 'result' | 'gameover'
//   round,           // 現在のラウンド番号
//   maxRounds,       // 最大ラウンド数 (カード上限: 10)
//   winsNeeded,      // 勝利に必要な勝ち数 (3点先取)
//   playerWins,      // プレイヤー勝利数
//   cpuWins,         // CPU勝利数
//   draws,           // 引き分け回数
//   playerHand,      // プレイヤー手札配列
//   cpuHandCount,    // CPU手札枚数
//   cpuHandElements, // CPU手札の属性配列（パワーは非公開） ['fire','water',...]
//   playerDeckCount, // プレイヤーデッキ残り枚数
//   cpuDeckCount,    // CPUデッキ残り枚数
//   playerPlayedCard,// プレイヤーが出したカード
//   cpuPlayedCard,   // CPUが出したカード
//   gameOver,        // ゲーム終了フラグ
//   difficulty,      // 難易度 ('easy' | 'normal' | 'hard')
//   playerChain,     // プレイヤーのチェイン状態 {element, count}
//   cpuChain,        // CPUのチェイン状態 {element, count}
//   roundHistory,    // ラウンド履歴配列
//   playerSacrificeBonus,    // 現在のサクリファイスボーナス蓄積値
//   playerSacrificedCards    // 今ターンにサクリファイスしたカード配列
// }
```

## agent-browserによる自動プレイガイド

### 基本フロー

```bash
# 1. ゲームを開く
agent-browser open http://localhost:8080

# 2. ゲーム状態を確認
agent-browser eval "JSON.stringify(game.getGameState())"

# 3. 有効な手を確認
agent-browser eval "JSON.stringify(game.getValidMoves())"

# 4. カードをプレイ
agent-browser eval "game.playCard(0)"

# 5. 次のselect phaseまで待機（gameOver時のハング防止にOR条件を追加）
agent-browser wait --fn "game.isReady() || game.getGameState().gameOver"

# 6. スクリーンショットで状態確認
agent-browser screenshot
```

### ラウンドループ例

```bash
# 全ラウンドを自動プレイ
while true; do
  # select phaseまたはgameOverまで待機
  agent-browser wait --fn "game.isReady() || game.getGameState().gameOver"

  # ゲーム終了チェック
  STATE=$(agent-browser eval "JSON.stringify(game.getGameState())")
  if echo "$STATE" | grep -q '"gameOver":true'; then
    echo "ゲーム終了"
    break
  fi

  # 有効手を取得してカードをプレイ
  agent-browser eval "game.playCard(0)"
done
```

### フェーズ遷移

| フェーズ | 説明 | 遷移先 |
|---------|------|--------|
| `select` | カード選択待ち。`playCard()` で遷移 | → `battle` |
| `battle` | CPU思考 + カード公開演出中 | → `result` |
| `result` | ラウンド結果表示中（約2.5秒） | → `select` or `gameover` |
| `gameover` | ゲーム終了。リザルトオーバーレイ（`.result-overlay`）が画面を覆う。`game.init()` でリセット | - |

### 戦略情報の取得

```javascript
// 手札の属性・パワーを確認
game.getValidMoves()
// → [{index: 0, card: {element: "fire", power: 8}, chainBonus: 0, isChainElement: false, reversalPossible: false}, ...]

// チェイン状態を確認（同属性連続でボーナス）
game.getGameState().playerChain
// → {element: "fire", count: 2}

// 直前のラウンド結果を確認
game.getLastRoundResult()
// → {round: 1, playerCard: {...}, cpuCard: {...}, playerPower: 8, cpuPower: 6, winner: "player", ...}

// 使用済みカードを確認（カードカウンティング用）
game.getUsedCards()
// → {player: [{element: "fire", power: 8, ...}, ...], cpu: [{element: "grass", power: 6, ...}, ...]}

// ラウンド履歴からCPUの傾向を分析
game.getGameState().roundHistory
// → [{round, playerCard, cpuCard, playerPower, cpuPower, winner, reversal, playerBreakdown, cpuBreakdown}, ...]
```

### 戦略ガイド

#### CPU手札属性の活用

CPUの手札の属性が公開されている（パワーは非公開）。`getGameState().cpuHandElements` で属性一覧を取得できる。

```javascript
// CPU手札の属性構成を確認
const state = game.getGameState();
const cpuElements = state.cpuHandElements;
// → ["fire", "fire", "water", "light", "dark"]

// CPUの手札に火が多い → 草カードは危険
const fireCount = cpuElements.filter(e => e === 'fire').length;
// → 2（火が2枚ある）
```

- **CPUの属性構成を読む**: 火が多ければ草は出しにくい。水が多ければ火は温存する
- **パワーが不明なのが鍵**: 属性有利でもCPUのパワーが高ければ負ける可能性がある
- **消去法で推測**: 使用済みカード(`getUsedCards()`)と合わせて、CPUの残りパワーを絞り込める

#### パワー反転（光 vs 闇）

光と闇が対戦するとパワーの**低い方が勝つ**。これはチェインボーナスや属性ボーナス加算後の最終パワーに適用される。

- `getValidMoves()` の `reversalPossible` が `true` のカードは反転が起きる可能性がある
- 光/闇カードは**低パワー（2, 4）が強く、高パワー（8, 10）が弱い**
- 相手の光/闇チェインが続いている場合、反転対策で低パワーの光/闇を温存すると有利

#### 属性有利ボーナス（+3）の活用

+3ボーナスは非常に大きく、パワー差を逆転できる。

| 自分 | 相手 | 基本パワー差 | 有利ボーナス後 |
|------|------|-------------|--------------|
| 火4 | 草6 | -2 | 火7 vs 草6 → **勝ち** |
| 水6 | 火8 | -2 | 水9 vs 火8 → **勝ち** |
| 草2 | 水4 | -2 | 草5 vs 水4 → **勝ち** |

- パワーが2低いまでなら属性有利で逆転可能
- 相手の属性が予測できる場合、低パワーでも有利属性なら勝てる

#### チェインコンボ戦略

`getValidMoves()` の `isChainElement` が `true` のカードを出すとチェイン継続。

- **2チェイン（+1）**: 小さいが確実なボーナス。狙いやすい
- **3チェイン（+2）**: 属性有利(+3)との併用で+5、パワー4のカードでもパワー9に
- **4チェイン（+4, 不利無効）**: 極めて強力。属性不利を無効化するため安全に高パワーを出せる

チェインを狙うには同じ属性のカードを連続で出す必要がある。手札に同属性が複数あるか確認すること。

#### サクリファイス戦略

`getValidMoves()` の `canSacrifice` と `sacrificeValue` でサクリファイス判断が可能。

```javascript
// サクリファイスしてからプレイする例
const moves = game.getValidMoves();

// パワー2のカードをサクリファイス
const weakCard = moves.find(m => m.card.power === 2);
if (weakCard && weakCard.canSacrifice) {
  game.sacrificeCard(weakCard.index);
}

// 残った最強カードをプレイ（サクリファイスボーナス付き）
const updatedMoves = game.getValidMoves();
const bestCard = updatedMoves.reduce((a, b) => a.card.power > b.card.power ? a : b);
game.playCard(bestCard.index);
```

- **弱いカードが来たらサクリファイスを検討**: パワー2のカードは通常戦では勝ちにくいが、+1ボーナスの燃料として有用
- **カード枚数とのトレードオフ**: サクリファイスで手札が減るため、残りラウンド数を考慮する
- **複数枚サクリファイスで一点突破**: パワー2+4をサクリファイス（+1+2=+3）してパワー10をプレイ → パワー13で勝負

#### カードカウンティング

全25枚のうち10枚ずつ配布、5枚は未使用。`getUsedCards()` で使用済みカードを取得できる。

```javascript
// 使用済みカードの取得
const used = game.getUsedCards();
// used.player → 自分が出したカード一覧
// used.cpu    → CPUが出したカード一覧
// → 残りのCPU手札を推測する材料になる
```

- CPUが火属性を多く使っている → 残りの手札に火は少ない
- 高パワーカード(10)は各属性1枚のみ → CPUが10を使った属性はもう10が来ない

#### 終盤戦略

`getGameState()` の `playerWins`, `cpuWins`, `winsNeeded`, `round` を使って状況判断。3点先取制のため、残りカード枚数も考慮する。

- **リード時**: 低パワーカードを消費して勝ち逃げを狙う
- **ビハインド時**: 高パワー+属性有利で確実に取りに行く
- **残りラウンド = 必要勝ち数**: 全勝が必要。最強の手を温存せず出す

### リセット・設定変更

```javascript
// ゲームリセット（リザルトオーバーレイも自動除去される）
game.init()

// 難易度変更（'easy' | 'normal' | 'hard'）
game.difficulty = 'hard'; game._saveDifficulty(); game.init();
```

**注意**: ゲーム終了時（`gameover`フェーズ）にはリザルトオーバーレイ（`.result-overlay`）が画面全体を覆う。`game.init()` を呼べばオーバーレイも除去されて新しいゲームが始まる。スクリーンショットで状態確認する際、オーバーレイが表示されていたらゲーム終了状態であることを意味する。

### エラーハンドリング

```javascript
// playCard() の戻り値でエラー検出
const success = game.playCard(0);
if (!success) {
  // select phase以外 or ゲーム終了 or インデックス範囲外
}

// isReady() でフェーズ確認してからプレイ
if (game.isReady()) {
  game.playCard(0);
}
```

### 属性相性早見表

```
火(🔥) → 草(🌿) → 水(💧) → 火(🔥)  （三すくみ: +3ボーナス）
光(✨) ⇔ 闇(🌑)                      （パワー反転: 低い方が勝つ）
無(⚪)                                （相性なし）
```

## ファイル構成

```
card-battle/
├── index.html     # UI構造（バトルエリア・サイドパネル・コントロール）
├── constants.js   # 属性定義・相性テーブル・属性名・カラー定数
├── sound.js       # Web Audio APIベースの効果音エンジン (SoundEngine)
├── utils.js       # カードプール生成・シャッフル・パーティクルエンジン
├── game.js        # メインゲームクラス (CardBattleGame) - ロジック・CPU AI・描画
├── ui.js          # 属性相性チャート・カード一覧モーダル・イベントリスナー・初期化
├── style.css      # スタイリング・アニメーション定義
└── README.md      # このファイル
```
