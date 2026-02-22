#!/usr/bin/env python3
"""summary1.txt から日本語ワードクラウド画像を生成し warehouse/ に保存する"""

import re
from collections import Counter
from janome.tokenizer import Tokenizer
from wordcloud import WordCloud

# --- 設定 ---
INPUT_FILE = "summary1.txt"
OUTPUT_FILE = "warehouse/wordcloud.jpg"
FONT_PATH = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"

# 除外する媒体名・セクション名
MEDIA_NAMES = {
    "ロイター", "ロイタービジネス", "ロイター経済", "ロイター市場",
    "ブルームバーグ", "ヤフー", "日経", "時事", "国内",
    "コメント", "記事リスト", "各セクション", "設定",
    "セクション", "記事", "最大", "記事数",
}

# 除外するストップワード（助詞的な名詞、一般的すぎる語など）
STOPWORDS = {
    "こと", "もの", "ため", "それ", "これ", "ところ", "よう",
    "はず", "わけ", "つもり", "ほう", "ほか", "まま", "とき",
    "さん", "氏", "的", "等", "上", "下", "中", "内", "前", "後",
    "年", "月", "日", "時", "分", "秒", "号", "回", "件", "人",
    "万", "億", "兆", "円", "ドル", "％", "以下", "以上",
    "今週", "今", "週", "指定", "手順", "形式", "抽出", "整理",
    "結果", "最大", "まで", "焦点", "コラム", "アングル",
    "マクロスコープ", "サマリー",
}

def load_text(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def extract_japanese_lines(text):
    """日本語の記事見出し行のみ抽出。英語のみの行やセクションヘッダを除外"""
    lines = text.split("\n")
    result = []
    for line in lines:
        line = line.strip()
        # 空行スキップ
        if not line:
            continue
        # セクションヘッダ（●●...●●）のみの行をスキップ
        if re.match(r"^●●.+●●$", line):
            continue
        # 太字マーカーの媒体設定行をスキップ
        if re.match(r"^\*?\s*\*?\*?●●", line):
            continue
        # 英語のみの行をスキップ（日本語文字が含まれていない）
        if not re.search(r"[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]", line):
            continue
        # 見出し行から末尾の媒体名と日付を除去
        # パターン: (媒体名)2026/02/22 や (媒体名1)2026/02/22
        line = re.sub(r"\([\w\s]+\d*\)\d{4}/\d{2}/\d{2}$", "", line)
        line = re.sub(r"（[\w\s]+\d*）\d{4}/\d{2}/\d{2}$", "", line)
        # 残った日付パターン除去
        line = re.sub(r"\d{4}/\d{2}/\d{2}", "", line)
        # 箇条書きマーカー除去
        line = re.sub(r"^\*\s*", "", line)
        line = re.sub(r"^\d+\.\s*", "", line)
        # セクションタイトル行除去
        if re.match(r"^(\*\*|●)", line):
            continue
        result.append(line.strip())
    return "\n".join(result)

def tokenize_and_count(text):
    """Janomeで形態素解析し、名詞を抽出してカウント"""
    tokenizer = Tokenizer()
    word_counts = Counter()

    for token in tokenizer.tokenize(text):
        pos = token.part_of_speech.split(",")[0]
        pos_detail = token.part_of_speech.split(",")[1] if len(token.part_of_speech.split(",")) > 1 else ""
        surface = token.surface

        # 名詞のみ（ただし非自立・代名詞・数は除外）
        if pos != "名詞":
            continue
        if pos_detail in ("非自立", "代名詞", "数", "接尾"):
            continue

        # 1文字の語は除外（意味が薄い）
        if len(surface) <= 1:
            continue

        # 英語・数字のみの語は除外（半角・全角両方）
        if re.match(r"^[a-zA-Zａ-ｚＡ-Ｚ0-9０-９\s　]+$", surface):
            continue

        # 媒体名を除外
        if surface in MEDIA_NAMES:
            continue

        # ストップワードを除外
        if surface in STOPWORDS:
            continue

        word_counts[surface] += 1

    return word_counts

def generate_wordcloud(word_counts, output_path):
    """ワードクラウド画像を生成してJPEGで保存"""
    wc = WordCloud(
        font_path=FONT_PATH,
        width=800,
        height=500,
        background_color="white",
        max_words=100,
        colormap="Dark2",
        min_font_size=10,
        max_font_size=80,
        prefer_horizontal=0.8,
    )
    wc.generate_from_frequencies(word_counts)
    wc.to_file(output_path)
    print(f"ワードクラウド画像を保存しました: {output_path}")

def main():
    text = load_text(INPUT_FILE)
    japanese_text = extract_japanese_lines(text)
    word_counts = tokenize_and_count(japanese_text)

    # 上位の語を表示（確認用）
    print("上位20語:")
    for word, count in word_counts.most_common(20):
        print(f"  {word}: {count}")

    generate_wordcloud(word_counts, OUTPUT_FILE)

if __name__ == "__main__":
    main()
