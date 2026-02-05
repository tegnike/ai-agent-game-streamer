#!/usr/bin/env python3
"""
背景透過画像生成スクリプト
Gemini APIで画像を生成し、PhotoRoom APIで背景を透過します
"""

import argparse
import base64
import io
import os
import sys
from pathlib import Path

import requests
from PIL import Image


def load_reference_image(image_path: str) -> tuple[str, str]:
    """
    参照画像を読み込んでBase64エンコードします

    Args:
        image_path: 画像ファイルのパス

    Returns:
        (Base64エンコードされたデータ, MIMEタイプ) のタプル
    """
    path = Path(image_path)
    suffix = path.suffix.lower()

    mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }

    mime_type = mime_types.get(suffix, "image/png")

    with open(path, "rb") as f:
        image_data = base64.b64encode(f.read()).decode("utf-8")

    return image_data, mime_type


def generate_image(
    prompt: str,
    api_key: str,
    aspect_ratio: str | None = None,
    reference_images: list[str] | None = None,
) -> bytes:
    """
    Gemini APIで画像を生成します

    Args:
        prompt: 画像生成プロンプト
        api_key: Gemini API キー
        aspect_ratio: アスペクト比（オプション）
        reference_images: 参照画像のパスリスト（オプション）

    Returns:
        生成された画像のバイトデータ
    """
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent"

    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json",
    }

    generation_config: dict = {
        "responseModalities": ["IMAGE"],
    }

    if aspect_ratio:
        generation_config["imageConfig"] = {"aspectRatio": aspect_ratio}

    # パーツを構築（テキスト + 参照画像）
    parts: list[dict] = [{"text": prompt}]

    if reference_images:
        for img_path in reference_images:
            image_data, mime_type = load_reference_image(img_path)
            parts.append({
                "inlineData": {
                    "mimeType": mime_type,
                    "data": image_data,
                }
            })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": generation_config,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()

    data = response.json()

    try:
        image_data = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
        return base64.b64decode(image_data)
    except (KeyError, IndexError) as e:
        raise ValueError(f"画像データの取得に失敗しました: {data}") from e


def upload_to_wavespeed(image_bytes: bytes, api_key: str) -> str:
    """
    WaveSpeed AIに画像をアップロードします

    Args:
        image_bytes: 画像のバイトデータ
        api_key: WaveSpeed API キー

    Returns:
        アップロードされた画像のURL
    """
    url = "https://api.wavespeed.ai/api/v3/media/upload/binary"

    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    files = {
        "file": ("image.png", image_bytes, "image/png"),
    }

    response = requests.post(url, headers=headers, files=files, timeout=120)
    response.raise_for_status()

    data = response.json()
    if data.get("code") != 200:
        raise ValueError(f"アップロード失敗: {data}")

    return data["data"]["download_url"]


def remove_background(image_bytes: bytes, api_key: str) -> Image.Image:
    """
    WaveSpeed AI (Bria) で画像の背景を透過します

    Args:
        image_bytes: 画像のバイトデータ
        api_key: WaveSpeed API キー

    Returns:
        背景透過されたPIL Image
    """
    # 1. 画像をWaveSpeed AIにアップロード
    print("  画像をアップロード中...")
    image_url = upload_to_wavespeed(image_bytes, api_key)
    print(f"  アップロード完了: {image_url[:50]}...")

    # 2. 背景除去APIを呼び出し（同期モード）
    url = "https://api.wavespeed.ai/api/v3/bria/remove-background"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "image": image_url,
        "enable_sync_mode": True,
    }

    response = requests.post(url, headers=headers, json=payload, timeout=180)
    response.raise_for_status()

    data = response.json()
    if data.get("code") != 200:
        raise ValueError(f"背景除去失敗: {data}")

    # 3. 結果画像のURLを取得
    task_data = data.get("data", {})
    outputs = task_data.get("outputs", [])

    if not outputs:
        # 非同期の場合は結果を取得
        task_id = task_data.get("id")
        if task_id:
            outputs = poll_for_result(task_id, api_key)
        else:
            raise ValueError(f"出力画像が取得できません: {data}")

    result_url = outputs[0]

    # 4. 結果画像をダウンロード
    print("  結果画像をダウンロード中...")
    img_response = requests.get(result_url, timeout=60)
    img_response.raise_for_status()

    return Image.open(io.BytesIO(img_response.content))


def poll_for_result(task_id: str, api_key: str, max_attempts: int = 30) -> list[str]:
    """
    非同期タスクの結果をポーリングで取得します

    Args:
        task_id: タスクID
        api_key: WaveSpeed API キー
        max_attempts: 最大試行回数

    Returns:
        出力画像URLのリスト
    """
    import time

    url = f"https://api.wavespeed.ai/api/v3/predictions/{task_id}/result"
    headers = {
        "Authorization": f"Bearer {api_key}",
    }

    for attempt in range(max_attempts):
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        data = response.json()
        if data.get("code") != 200:
            raise ValueError(f"結果取得失敗: {data}")

        task_data = data.get("data", {})
        status = task_data.get("status")

        if status == "completed":
            outputs = task_data.get("outputs", [])
            if outputs:
                return outputs
            raise ValueError("出力画像がありません")
        elif status == "failed":
            raise ValueError(f"タスク失敗: {task_data}")

        print(f"  処理中... ({attempt + 1}/{max_attempts})")
        time.sleep(2)

    raise TimeoutError("タスクがタイムアウトしました")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gemini APIで画像を生成し、背景を透過します",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用例:
  python generate_transparent.py "可愛い猫" -o cat.png
  python generate_transparent.py "赤ちゃん" --aspect-ratio 3:4 -o baby.png

参照画像を使った編集:
  python generate_transparent.py "この画像をアニメ風に変換" -r input.png -o anime.png
  python generate_transparent.py "これら2つの画像を合成" -r img1.png -r img2.png -o merged.png

環境変数:
  GEMINI_API_KEY: Gemini APIキー（必須）
  WAVESPEED_API_KEY: WaveSpeed AIキー（必須）
        """,
    )
    parser.add_argument("prompt", help="画像生成プロンプト")
    parser.add_argument(
        "-o",
        "--output",
        help="出力ファイルのパス（デフォルト: output.png）",
        default="output.png",
    )
    parser.add_argument(
        "--aspect-ratio",
        help="アスペクト比（例: 1:1, 16:9, 3:4）",
        default=None,
    )
    parser.add_argument(
        "-r",
        "--reference",
        action="append",
        dest="reference_images",
        help="参照画像のパス（複数指定可能）",
        default=None,
    )

    args = parser.parse_args()

    # APIキーの取得
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_api_key:
        print("エラー: 環境変数 GEMINI_API_KEY が設定されていません", file=sys.stderr)
        sys.exit(1)

    wavespeed_api_key = os.environ.get("WAVESPEED_API_KEY")
    if not wavespeed_api_key:
        print("エラー: 環境変数 WAVESPEED_API_KEY が設定されていません", file=sys.stderr)
        sys.exit(1)

    try:
        if args.reference_images:
            print(f"参照画像: {', '.join(args.reference_images)}")
        print(f"画像を生成中: {args.prompt}")
        image_bytes = generate_image(
            args.prompt, gemini_api_key, args.aspect_ratio, args.reference_images
        )
        print("画像生成完了")

        print("背景を透過中（WaveSpeed AI）...")
        transparent_image = remove_background(image_bytes, wavespeed_api_key)
        print("背景透過完了")

        # 出力パスの処理
        output_path = Path(args.output)
        if output_path.suffix.lower() != ".png":
            output_path = output_path.with_suffix(".png")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        transparent_image.save(output_path, format="PNG")

        print(f"保存完了: {output_path}")

    except requests.exceptions.HTTPError as e:
        print(f"API エラー: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"エラー: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
