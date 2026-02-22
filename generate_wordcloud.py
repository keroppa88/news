import re
from collections import Counter
from datetime import datetime
from janome.tokenizer import Tokenizer
from wordcloud import WordCloud
import os
 
# Read summary1.txt
with open("summary1.txt", "r", encoding="utf-8") as f:
    text = f.read()
 
# Remove source tags like (ロイター), (BBC), dates, section headers, bullets
text = re.sub(r"\([^)]*\)", "", text)
text = re.sub(r"（[^）]*）", "", text)
text = re.sub(r"\d{4}/\d{2}/\d{2}", "", text)
text = re.sub(r"●+[^●]*●+", "", text)
text = re.sub(r"[*＊]", "", text)
text = re.sub(r"最大記事数\d+まで", "", text)
text = re.sub(r"日本時間", "", text)
text = re.sub(r"UTC\+9", "", text)
 
# Tokenize with Janome
tokenizer = Tokenizer()
words = []
 
# Filter for meaningful parts of speech
target_pos = ["名詞", "動詞", "形容詞"]
stop_words = {
    "する", "いる", "ある", "なる", "れる", "られる", "こと", "もの", "ため",
    "よう", "さん", "それ", "これ", "あれ", "どれ", "ここ", "そこ", "あそこ",
    "の", "に", "は", "を", "が", "で", "と", "も", "や", "へ", "から", "まで",
    "より", "など", "か", "だ", "です", "ます", "た", "て", "て", "い",
    "記事", "セクション", "設定", "リスト", "以下", "指定", "手順", "形式",
    "抽出", "整理", "結果", "示す", "各", "数", "氏", "1", "2", "3", "4", "5",
    "年", "月", "日", "10", "15", "20", "25", "万", "兆", "円", "人",
    "記事リスト", "セクションの設定",
    "UTC", "焦点", "コラム", "アングル", "マクロスコープ",
    "的", "化", "性", "率", "額", "等", "前", "後", "上", "下", "中", "間",
    "今", "新た", "巡る", "受け", "向け", "できる", "思う", "見る",
    "to", "in", "for", "and", "of", "on", "at", "by", "is", "it", "an", "as",
    "or", "if", "no", "so", "up", "do", "my", "me", "he", "we", "us",
    "be", "go", "am", "To", "In", "For", "And", "Of", "On", "At", "By",
    "Is", "It", "An", "As", "Or", "If", "No", "So", "Up", "Do",
}
 
for token in tokenizer.tokenize(text):
    pos = token.part_of_speech.split(",")[0]
    sub_pos = token.part_of_speech.split(",")[1] if len(token.part_of_speech.split(",")) > 1 else ""
    base = token.base_form if token.base_form != "*" else token.surface
 
    # Skip non-target parts of speech
    if pos not in target_pos:
        continue
    # Skip auxiliary verbs and particles
    if sub_pos in ["非自立", "接尾", "代名詞", "数"]:
        continue
    # Skip single character words and stop words
    if len(base) <= 1 or base in stop_words:
        continue
    # Skip common English stop words that Janome may produce
    if re.match(r'^[A-Za-z]+$', base) and base.lower() in {
        "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
        "was", "one", "our", "out", "has", "had", "his", "how", "its", "may",
        "new", "now", "say", "she", "too", "use", "than", "that", "them",
        "then", "they", "this", "from", "have", "been", "with", "will", "more",
        "over", "such", "what", "when", "who", "why", "said", "each", "make",
        "like", "long", "look", "many", "some", "time", "very", "your", "into",
        "year", "also", "back", "most", "only", "come", "just", "know", "take",
        "about", "after", "being", "could", "first", "their", "there", "these",
        "those", "would", "other", "which", "should", "right", "still", "think",
        "where", "does", "going", "final", "good", "well", "once", "here",
    }:
        continue
 
    words.append(base)
 
# Also extract English words (4+ chars) for BBC/NYT articles
english_words = re.findall(r"[A-Za-z]{4,}", text)
english_stop = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
    "was", "one", "our", "out", "has", "had", "his", "how", "its", "may",
    "new", "now", "say", "she", "too", "use", "BBC", "NYT", "WSJ", "UTC",
    "than", "that", "them", "then", "they", "this", "from", "have", "been",
    "with", "will", "more", "over", "such", "what", "when", "who", "why",
    "said", "each", "make", "like", "long", "look", "many", "some",
    "time", "very", "your", "into", "year", "also", "back", "most",
    "only", "come", "just", "know", "take", "people", "about", "after",
    "being", "could", "first", "their", "there", "these", "those", "would",
    "other", "which", "should", "right", "still", "think", "where",
    "does", "going", "Final", "Right", "Good", "well", "How", "The",
    "They", "You", "Can", "Not", "His", "Her", "Its",
}
common_english_stop = {
    "the", "and", "for", "are", "but", "not", "you", "all", "can", "her",
    "was", "one", "our", "out", "has", "had", "his", "how", "its", "may",
    "new", "now", "say", "she", "too", "use", "than", "that", "them",
    "then", "they", "this", "from", "have", "been", "with", "will", "more",
    "over", "such", "what", "when", "who", "why", "said", "each", "make",
    "like", "long", "look", "many", "some", "time", "very", "your", "into",
    "year", "also", "back", "most", "only", "come", "just", "know", "take",
    "people", "about", "after", "being", "could", "first", "their", "there",
    "these", "those", "would", "other", "which", "should", "right", "still",
    "think", "where", "does", "going", "final", "good", "well", "once",
    "mocked", "being", "both", "deadly", "deep", "five", "gets", "here",
    "large", "left", "made", "more", "much", "need", "over", "real",
    "took", "took", "whether", "while", "before", "between", "during",
    "under", "again", "further", "same", "down", "days", "since", "away",
}
for w in english_words:
    if w.lower() not in common_english_stop and len(w) >= 4:
        words.append(w)
 
# Count word frequencies
word_freq = Counter(words)
 
if not word_freq:
    print("No words found!")
    exit(1)
 
print(f"Top 30 words: {word_freq.most_common(30)}")
 
# Generate word cloud
font_path = "/usr/share/fonts/opentype/ipafont-gothic/ipag.ttf"
wc = WordCloud(
    font_path=font_path,
    width=800,
    height=400,
    background_color="white",
    max_words=100,
    max_font_size=80,
    min_font_size=10,
    colormap="tab20",
    prefer_horizontal=0.7,
)
 
wc.generate_from_frequencies(word_freq)
 
# Save as JPEG at top level
top_level_path = "wordcloud.jpg"
wc.to_file(top_level_path)
print(f"Word cloud saved to {top_level_path}")

# Save as JPEG in warehouse folder with date-based filename
os.makedirs("warehouse", exist_ok=True)
date_filename = datetime.now().strftime("%Y%m%d") + ".jpg"
warehouse_path = os.path.join("warehouse", date_filename)
wc.to_file(warehouse_path)
print(f"Word cloud saved to {warehouse_path}")
