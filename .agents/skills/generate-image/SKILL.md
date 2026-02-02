---
name: generate-image
description: Gemini APIを使用して画像を生成します。テキストプロンプトからの画像生成が可能です。
---

# Gemini API 画像生成スキル

## 概要

Google Gemini APIを使用してテキストプロンプトから画像を生成します。curlを使用するため、追加の依存関係は不要です。

## 利用可能なモデル

| モデル | モデルID | 特徴 |
|--------|----------|------|
| Gemini 3 Pro Image Preview | `gemini-3-pro-image-preview` | プロフェッショナルアセット制作向け |

## 環境変数

`GEMINI_API_KEY` が設定されている必要があります。

## オプション設定

### アスペクト比（aspectRatio）

指定可能な値: `"1:1"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:3"`, `"4:5"`, `"5:4"`, `"9:16"`, `"16:9"`, `"21:9"`

### 画像サイズ（imageSize）

指定可能な値: `"1K"`, `"2K"`, `"4K"`

**注意**: 大文字の `K` を使用してください（小文字は拒否されます）

## 使用方法

### 基本的な画像生成（オプションなし）

```bash
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "YOUR_PROMPT_HERE"}]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"]
    }
  }' | jq -r '.candidates[0].content.parts[0].inlineData.data' | base64 -d > output.png
```

### アスペクト比・画像サイズを指定して生成

```bash
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts": [{"text": "YOUR_PROMPT_HERE"}]
    }],
    "generationConfig": {
      "responseModalities": ["IMAGE"],
      "imageConfig": {
        "aspectRatio": "16:9",
        "imageSize": "2K"
      }
    }
  }' | jq -r '.candidates[0].content.parts[0].inlineData.data' | base64 -d > output.png
```

### 参照画像を使った画像編集

既存の画像を参照して、スタイル変換や編集が可能です。参照画像はBase64エンコードして`inlineData`として送信します。

```bash
# 画像をBase64エンコード
IMAGE_DATA=$(base64 -i input.png)

curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"contents\": [{
      \"parts\": [
        {\"text\": \"この画像をアニメ風に変換\"},
        {
          \"inlineData\": {
            \"mimeType\": \"image/png\",
            \"data\": \"$IMAGE_DATA\"
          }
        }
      ]
    }],
    \"generationConfig\": {
      \"responseModalities\": [\"IMAGE\"]
    }
  }" | jq -r '.candidates[0].content.parts[0].inlineData.data' | base64 -d > output.png
```

### 参照画像を使った生成（Pythonスクリプト）

複雑な処理やAPIキーに特殊文字が含まれる場合はPythonスクリプトを推奨します。

```python
import os
import json
import base64
import requests
from pathlib import Path

api_key = os.environ.get("GEMINI_API_KEY")
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent"

# 参照画像を読み込み
with open("input.png", "rb") as f:
    image_data = base64.b64encode(f.read()).decode("utf-8")

headers = {
    "x-goog-api-key": api_key,
    "Content-Type": "application/json",
}

payload = {
    "contents": [{
        "parts": [
            {"text": "この画像をアニメ風に変換"},
            {
                "inlineData": {
                    "mimeType": "image/png",
                    "data": image_data
                }
            }
        ]
    }],
    "generationConfig": {"responseModalities": ["IMAGE"]}
}

response = requests.post(url, headers=headers, json=payload, timeout=120)
data = response.json()
result_data = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
result_bytes = base64.b64decode(result_data)

with open("output.png", "wb") as f:
    f.write(result_bytes)
```

### 参照画像のサポート形式

| 形式 | MIMEタイプ |
|------|-----------|
| PNG | `image/png` |
| JPEG | `image/jpeg` |
| GIF | `image/gif` |
| WebP | `image/webp` |

### 参照画像の活用例

- **スタイル変換**: 写真をイラストやアニメ風に変換
- **画像編集**: 背景の変更、オブジェクトの追加・削除
- **複数画像の合成**: 複数の参照画像を組み合わせて新しい画像を生成
- **キャラクターの一貫性**: 同じキャラクターの異なるポーズや表情を生成

## レスポンス形式

レスポンスには以下が含まれます：

- **画像データ**: base64エンコードされたインラインデータ（`.inlineData.data`）
- **MIMEタイプ**: `image/png` など

## 注意事項

- 画像はbase64エンコードされて返されるため、`base64 -d` でデコードしてファイルに保存します
- APIキーは環境変数 `GEMINI_API_KEY` で設定してください
- `jq` コマンドが必要です
- 生成された画像の著作権やライセンスについてはGoogleの利用規約を確認してください

## トラブルシューティング

### curlコマンドでエラーが発生する場合

**症状**:
```
curl: option : blank argument where content is expected
```

**原因**:
`GEMINI_API_KEY`に特殊文字（`+`, `/`, `=`など、Base64エンコードされたキーによく含まれる）が入っている場合、シェルの変数展開で問題が発生することがあります。

**解決策1**: Pythonスクリプトを使用する

```python
import os
import json
import base64
import requests

api_key = os.environ.get("GEMINI_API_KEY")
url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent"

headers = {
    "x-goog-api-key": api_key,
    "Content-Type": "application/json",
}

payload = {
    "contents": [{"parts": [{"text": "YOUR_PROMPT_HERE"}]}],
    "generationConfig": {"responseModalities": ["IMAGE"]}
}

response = requests.post(url, headers=headers, json=payload, timeout=120)
data = response.json()
image_data = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
image_bytes = base64.b64decode(image_data)

with open("output.png", "wb") as f:
    f.write(image_bytes)
```

**解決策2**: APIキーをファイルから読み込む

```bash
# APIキーをファイルに保存（改行なし）
echo -n "$GEMINI_API_KEY" > /tmp/api_key.txt

# ファイルから読み込んで使用
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "x-goog-api-key: $(cat /tmp/api_key.txt)" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "YOUR_PROMPT"}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}' \
  | jq -r '.candidates[0].content.parts[0].inlineData.data' | base64 -d > output.png

# ファイルを削除
rm /tmp/api_key.txt
```

### 画像が空になる場合

**症状**: 出力ファイルが0バイト

**原因**:
- APIレスポンスにエラーが含まれている
- jqのパスが間違っている

**デバッグ方法**:
```bash
# レスポンス全体を確認
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent" \
  -H "x-goog-api-key: $GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "test"}]}], "generationConfig": {"responseModalities": ["IMAGE"]}}' \
  | jq .
```

### 背景透過画像を生成したい場合

このスキルは画像生成のみを行います。背景透過が必要な場合は `generate-transparent-image` スキルを使用してください。
