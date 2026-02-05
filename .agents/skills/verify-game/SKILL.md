---
name: verify-game
description: ゲームを実際にプレイしてクリアできるか検証し、詰まった場合は原因を特定・修正するスキル。
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(agent-browser:*), Bash(python3 -m http.server*), Bash(lsof -i:*), Bash(kill *), Bash(mkdir -p logs*)
---

# Game Verification and Fix Skill

ゲームを実際にプレイしてクリアできるか検証し、問題があれば修正するスキルです。

## 目的

**play-gameスキルを使うエージェントが詰まらずにクリアできること**を保証する。

## play-game との違い

| 観点 | play-game | verify-game |
|------|-----------|-------------|
| ソースコード | 読み取り禁止（READMEのみ） | 読み取り・修正可能 |
| 目的 | エンタメとしてプレイ | 詰まらないことを保証 |
| 詰まった時 | 諦める or 適当に操作 | 原因特定 → 修正 → 再プレイ |
| 出力 | 実況付きプレイ | 検証レポート + 修正 |

---

## 検証フロー

### Phase 1: 事前準備

```bash
# 1. ソースコードを読んでゲーム構造を把握
cat games/<game-name>/script.js
cat games/<game-name>/README.md

# 2. HTTPサーバー起動（既存プロセスがなければ）
lsof -i:8888 || (cd /Users/user/WorkSpace/ai-agent-game-streamer/games && python3 -m http.server 8888 &)

# 3. ゲームを開く（--headed必須）
agent-browser --headed open http://127.0.0.1:8888/<game-name>/index.html

# 4. 初期状態をスクリーンショット
mkdir -p logs
agent-browser screenshot "logs/$(date +%Y%m%d-%H%M%S)_initial.png"
```

### Phase 2: 実際にプレイしてクリアを目指す

**play-gameスキルと同じ方法でゲームをプレイする。**

ただし、**ソースコードを読めるので、APIの正確な挙動を把握した上でプレイできる。**

#### ボードゲーム（othello, gomoku）

```bash
# 有効な手を確認
agent-browser eval "JSON.stringify(game.getValidMoves(game.currentPlayer))"

# 手を打つ（0.5秒以上間隔を空ける）
agent-browser eval "game.handleCellClick(row, col)"
sleep 0.5

# ゲーム終了まで繰り返す
agent-browser eval "game.gameOver"
```

#### パズルゲーム（sokoban）

```bash
# 現在位置を確認
agent-browser eval "JSON.stringify(game.playerPos)"

# 移動（0.5秒以上間隔を空ける）
agent-browser eval "game.move('right')"
sleep 0.5

# クリアまで繰り返す
agent-browser eval "game.checkClear()"
```

#### カードゲーム（card-battle）

```bash
# ゲーム状態を確認
agent-browser eval "JSON.stringify(game.getGameState())"

# カードをプレイ
agent-browser eval "game.playCard(0)"
```

### Phase 3: 詰まったら原因を特定

**「詰まった」の定義**:
- 有効な手がないのにゲーム終了していない
- 操作しても状態が変わらない
- APIが期待と異なる値を返す
- エラーが発生する

**原因特定の手順**:

1. **症状を確認**
   ```bash
   # 現在の状態をダンプ
   agent-browser eval "JSON.stringify(game)"
   agent-browser screenshot "logs/$(date +%Y%m%d-%H%M%S)_stuck.png"
   ```

2. **ソースコードで原因を調査**
   ```bash
   # 該当メソッドの実装を確認
   grep -A 30 "getValidMoves" games/<game-name>/script.js
   ```

3. **問題を分類**

   | タイプ | 症状 | 修正対象 |
   |--------|------|---------|
   | A: READMEの曖昧さ | コードは正しいがドキュメントが不明確で誤操作した | README.md |
   | B: コードのバグ | APIが期待通りに動作しない | script.js |
   | C: API不足 | 必要な情報を取得するAPIがない | script.js + README.md |

### Phase 4: 修正を適用

**タイプA: READMEの曖昧さ**

例: `getValidMoves(player)` の `player` が `1=黒, 2=白` だと分からなかった

```markdown
# 修正前
| `game.getValidMoves(player)` | 有効な手の一覧を取得 |

# 修正後
| `game.getValidMoves(player)` | 有効な手の一覧を取得（player: 1=黒, 2=白）。戻り値: `[{ row: number, col: number }, ...]` |
```

**タイプB: コードのバグ**

例: `handleCellClick` がプレイヤーのターンでも動作しない

```javascript
// 修正前
handleCellClick(row, col) {
    if (this.gameOver || this.currentPlayer !== BLACK) return;
    // BLACK=1 だが、初期化で currentPlayer が設定されていない
}

// 修正後
handleCellClick(row, col) {
    if (this.gameOver || this.currentPlayer !== BLACK) return;
    // init() で this.currentPlayer = BLACK を確実に設定
}
```

**タイプC: API不足**

例: 現在のステージ番号を取得するAPIがない

```javascript
// script.js に追加
get currentStageNumber() {
    return this.currentStage;
}
```

```markdown
// README.md に追加
| `game.currentStageNumber` | 現在のステージ番号（0-9） |
```

### Phase 5: 再プレイで検証

```bash
# ページリロードして修正を反映
agent-browser reload

# 再度プレイしてクリアを目指す
# Phase 2 に戻る
```

**クリアできたら Phase 6 へ進む。**

### Phase 6: 検証後チェック（必須）

クリア成功後、以下のチェックを**必ず**実施する。

#### 6-1. READMEの完全性チェック

play-gameスキルはREADMEのみを参照するため、以下がすべて記載されているか確認：

| チェック項目 | 確認内容 |
|-------------|---------|
| **操作API** | `move()`, `handleCellClick()` 等の操作メソッドが記載されているか |
| **状態取得API** | ゲーム状態を取得するプロパティ（`playerPos`, `board`, `currentPlayer` 等）が記載されているか |
| **戻り値の説明** | メソッドの戻り値の型と意味が明記されているか（`true`/`false` の意味など） |
| **定数の説明** | セルタイプやプレイヤー番号などの定数値が説明されているか |
| **クリア条件** | クリア判定APIとその使い方が記載されているか |

**不足があれば README.md を修正する。**

#### 6-2. ゲームロジックのレビュー

検証中に使用したAPIやゲームデータに問題がないか確認：

| チェック項目 | 確認内容 |
|-------------|---------|
| **クリア可能性** | すべてのステージ/初期状態がクリア可能か（詰み状態がないか） |
| **API一貫性** | READMEに記載されたAPIが実際のコードと一致しているか |
| **エッジケース** | 境界条件（盤面端、最終ステージ等）で正常動作するか |

**問題があれば script.js を修正し、Phase 5 に戻って再検証する。**

#### 6-3. チェックリスト

```markdown
## 検証後チェックリスト

- [ ] README: 操作APIが記載されている
- [ ] README: 状態取得プロパティが記載されている
- [ ] README: 戻り値の型と意味が明記されている
- [ ] README: 定数値（セルタイプ等）が説明されている
- [ ] ゲーム: すべてのステージがクリア可能
- [ ] ゲーム: APIがREADMEの説明通りに動作する
```

**すべてチェックが完了したら検証完了。**

---

## ゲーム別の「クリア」条件

| ゲーム | クリア条件 | 確認方法 |
|--------|----------|---------|
| othello | ゲーム終了（両者パス or 盤面埋まる） | `game.gameOver === true` |
| gomoku | 5つ並ぶ or 盤面埋まる | `game.winner !== null` |
| sokoban | 全箱がゴール上 | `game.checkClear() === true` |
| card-battle | 3勝する or 相手が3勝 | `game.getGameState().gameOver === true` |

---

## 出力フォーマット

検証完了後、以下の形式でレポートを出力：

```markdown
# ゲーム検証レポート: <game-name>

## 検証日時
YYYY-MM-DD HH:MM

## 結果
クリア成功 / クリア失敗（修正後成功）

## プレイログ
1. [操作] → [結果]
2. [操作] → [結果]
...

## 発見した問題（あれば）

### 問題1: [タイプA/B/C] 問題の概要
- **症状**: 何が起きたか
- **原因**: なぜ起きたか
- **修正内容**: 何を修正したか
- **修正ファイル**: どのファイルを変更したか

## 修正したファイル一覧
- games/<game-name>/README.md
- games/<game-name>/script.js

## play-gameスキルへの影響
影響なし / [影響内容を記載]

## 検証後チェックリスト
- [x] README: 操作APIが記載されている
- [x] README: 状態取得プロパティが記載されている
- [x] README: 戻り値の型と意味が明記されている
- [x] README: 定数値（セルタイプ等）が説明されている
- [x] ゲーム: すべてのステージがクリア可能
- [x] ゲーム: APIがREADMEの説明通りに動作する
```

---

## 注意事項

1. **--headed 必須**: ブラウザは必ず `--headed` オプションで起動
2. **0.5秒以上の間隔**: 操作は間隔を空けて実行（状態反映のため）
3. **破壊的変更に注意**: APIシグネチャを変更する場合、play-gameスキルへの影響を考慮
4. **大きな修正前は git commit**: 変更を追跡できるように
5. **スクリーンショットを残す**: `logs/` にスクリーンショットを保存

---

## 使用例

```bash
# オセロを検証（クリアできるまでプレイ、問題あれば修正）
/verify-game othello

# 倉庫番ステージ1を検証
/verify-game sokoban

# 五目並べを検証
/verify-game gomoku
```

検証後、`/play-game <game>` で修正が有効か確認することを推奨。
