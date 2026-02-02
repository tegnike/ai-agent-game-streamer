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


def remove_background(image_bytes: bytes, api_key: str) -> Image.Image:
    """
    PhotoRoom APIで画像の背景を透過します

    Args:
        image_bytes: 画像のバイトデータ
        api_key: PhotoRoom API キー

    Returns:
        背景透過されたPIL Image
    """
    url = "https://sdk.photoroom.com/v1/segment"

    headers = {
        "x-api-key": api_key,
    }

    files = {
        "image_file": ("image.png", image_bytes, "image/png"),
    }

    data = {
        "format": "png",
        "channels": "rgba",
    }

    response = requests.post(url, headers=headers, files=files, data=data, timeout=120)
    response.raise_for_status()

    # レスポンスから画像を読み込む
    return Image.open(io.BytesIO(response.content))


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

    photoroom_api_key = os.environ.get("PHOTOROOM_API_KEY")
    if not photoroom_api_key:
        print("エラー: 環境変数 PHOTOROOM_API_KEY が設定されていません", file=sys.stderr)
        sys.exit(1)

    try:
        if args.reference_images:
            print(f"参照画像: {', '.join(args.reference_images)}")
        print(f"画像を生成中: {args.prompt}")
        image_bytes = generate_image(
            args.prompt, gemini_api_key, args.aspect_ratio, args.reference_images
        )
        print("画像生成完了")

        print("背景を透過中（PhotoRoom API）...")
        transparent_image = remove_background(image_bytes, photoroom_api_key)
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
