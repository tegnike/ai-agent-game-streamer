---
name: generate-transparent-image
description: 背景透過された画像を生成する。Gemini APIで画像生成後、PhotoRoom APIで背景を自動透過。透過PNG、切り抜き画像、背景なし画像の生成に使用。
---

# 背景透過画像生成スキル

Gemini APIで画像を生成し、PhotoRoom APIで背景を自動透過します。1回の指示で背景透過済みの画像を生成できます。

## 機能

- テキストプロンプトから画像を生成
- PhotoRoom APIで高精度な背景透過
- PNG形式（アルファチャンネル付き）で出力

## 環境変数

以下の環境変数が設定されている必要があります：

- `GEMINI_API_KEY` - Gemini APIキー
- `PHOTOROOM_API_KEY` - PhotoRoom APIキー

## プロンプトの書き方

**重要**: 画像生成プロンプトには必ず「背景透過画像を生成」という指示を含めてください。

これにより、Gemini APIが背景がシンプルな画像を生成しやすくなり、PhotoRoomによる背景透過の精度が向上します。

### プロンプト例

```
# 良い例
"背景透過画像を生成: 可愛い赤ちゃん、実写風"
"背景透過画像を生成: マレーシアのナシレマ、フードフォトグラフィ"
"背景透過画像を生成: 白い猫、isolated on white background"

# 悪い例（背景透過の指示がない）
"可愛い赤ちゃん"
"マレーシアのナシレマ"
```

### 推奨フォーマット

```
背景透過画像を生成: [被写体の説明], [スタイル指定（実写風、イラスト風など）]
```

## 実行方法

```bash
.claude/skills/generate-transparent-image/.venv/bin/python .claude/skills/generate-transparent-image/scripts/generate_transparent.py "<プロンプト>" -o <出力ファイル>
```

## 使用例

```bash
# 基本的な使い方
.claude/skills/generate-transparent-image/.venv/bin/python .claude/skills/generate-transparent-image/scripts/generate_transparent.py "背景透過画像を生成: 可愛い赤ちゃん、実写風" -o baby.png

# アスペクト比を指定
.claude/skills/generate-transparent-image/.venv/bin/python .claude/skills/generate-transparent-image/scripts/generate_transparent.py "背景透過画像を生成: 白い猫、実写風フォトグラフィ" --aspect-ratio 3:4 -o cat.png

# 正方形で生成
.claude/skills/generate-transparent-image/.venv/bin/python .claude/skills/generate-transparent-image/scripts/generate_transparent.py "背景透過画像を生成: 赤いりんご、プロダクトフォト" --aspect-ratio 1:1 -o apple.png
```

## 参照画像を使った編集

既存の画像を参照して、スタイル変換や編集が可能です。

```bash
# 画像をアニメ風に変換
.claude/skills/generate-transparent-image/.venv/bin/python .claude/skills/generate-transparent-image/scripts/generate_transparent.py "この画像をアニメ風に変換" -r input.png -o anime.png

# 複数の画像を参照
.claude/skills/generate-transparent-image/.venv/bin/python .claude/skills/generate-transparent-image/scripts/generate_transparent.py "これらの画像を合成して新しいキャラクターを作成" -r ref1.png -r ref2.png -o merged.png

# 既存キャラクターの背景透過版を生成
.claude/skills/generate-transparent-image/.venv/bin/python .claude/skills/generate-transparent-image/scripts/generate_transparent.py "背景透過画像を生成: このキャラクターを同じスタイルで" -r character.png -o transparent_char.png
```

### 参照画像のサポート形式

- PNG（`.png`）
- JPEG（`.jpg`, `.jpeg`）
- GIF（`.gif`）
- WebP（`.webp`）

## オプション

| オプション | 説明 |
|-----------|------|
| `-o`, `--output` | 出力ファイルのパス（デフォルト: output.png） |
| `--aspect-ratio` | アスペクト比（1:1, 16:9, 3:4, 4:3, 9:16 など） |
| `-r`, `--reference` | 参照画像のパス（複数指定可能） |

## アスペクト比

指定可能な値: `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`, `9:16`, `16:9`, `21:9`

## 環境セットアップ

Python 3.10の仮想環境が必要です。初回セットアップ：

```bash
cd .claude/skills/generate-transparent-image
uv venv --python 3.10 .venv
uv pip install requests pillow -p .venv
```

## 処理の流れ

1. Gemini API（gemini-3-pro-image-preview）で画像生成
2. PhotoRoom APIで背景を自動検出・透過
3. PNG形式で保存

## PhotoRoom APIについて

- エンドポイント: `https://sdk.photoroom.com/v1/segment`
- 対応フォーマット: PNG, JPEG, WebP
- 高精度な被写体検出と背景透過
- API料金: 1回あたり約$0.02

## 注意事項

- 生成された画像の著作権やライセンスについてはGoogleの利用規約を確認してください
- PhotoRoom APIの利用にはAPIキーが必要です（https://www.photoroom.com/api から取得）

## トラブルシューティング

### 仮想環境の再作成

```bash
cd .claude/skills/generate-transparent-image
rm -rf .venv
uv venv --python 3.10 .venv
uv pip install requests pillow -p .venv
```

### APIキーに特殊文字が含まれる場合

`GEMINI_API_KEY`や`PHOTOROOM_API_KEY`に特殊文字（`+`, `/`, `=`など）が含まれている場合、curlコマンドでエラーが発生することがあります。

**解決策**:
本スキルはPythonスクリプトを使用しているため、この問題は発生しません。

### DNS解決エラー

仮想環境からネットワークアクセスができない場合：
```
Failed to resolve 'generativelanguage.googleapis.com'
```

**原因**: 仮想環境のPythonがシステムのDNS設定を正しく参照できていない

**解決策**: システムのPythonを使用するか、仮想環境を再作成してください。
