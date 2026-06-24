#!/usr/bin/env python3
"""2026年4月に多く取り上げられた用語ランキングを集計するスクリプト"""

import sys
import re
import glob
from collections import Counter
from datetime import datetime


def aggregate_terms(year_month: str) -> list[tuple[str, int]]:
    pattern = f"/home/user/news/warehouse/{year_month}*.text"
    files = sorted(glob.glob(pattern))
    if not files:
        print(f"対象ファイルが見つかりません: {pattern}", file=sys.stderr)
        return []

    text = ""
    for f in files:
        with open(f, encoding="utf-8") as fh:
            text += fh.read()

    terms = {
        "AI技術・人工知能":       ["AI", "生成AI", "ChatGPT", "GPT", "LLM", "AIロボット"],
        "イラン戦争・中東情勢":   ["イラン", "ホルムズ", "カーグ島", "ペルシャ湾"],
        "トランプ・米政権":        ["トランプ", "DOGE", "米大統領", "イーロン・マスク"],
        "原油・エネルギー高騰":    ["原油", "ガソリン", "石油", "エネルギー価格"],
        "高市政権・日本政治":      ["高市", "首相", "内閣", "閣議", "自民"],
        "中国・米中対立":          ["中国", "米中", "人民元"],
        "日銀・金融政策":          ["日銀", "利上げ", "植田", "金融政策"],
        "ウクライナ・ロシア停戦":  ["ウクライナ", "ロシア", "プーチン", "ゼレンスキー"],
        "OpenAI・Anthropic":      ["OpenAI", "アンソロピック", "Anthropic", "サム・アルトマン"],
        "半導体・エヌビディア":    ["半導体", "TSMC", "ラピダス", "エヌビディア", "NVIDIA"],
        "株式市場・相場":          ["株価", "日経平均", "ダウ", "S&P", "ナスダック"],
        "イスラエル・ガザ":        ["イスラエル", "ガザ", "パレスチナ", "ハマス"],
        "アップル・iPhone":        ["アップル", "Apple", "iPhone"],
        "関税・貿易摩擦":          ["関税", "貿易戦争", "報復関税", "相互関税"],
        "KKR・太陽HD買収":         ["KKR", "太陽HD", "非公開化"],
        "ウラン濃縮・核合意":      ["ウラン濃縮", "核合意", "核武装"],
        "FRB・米金利":             ["FRB", "パウエル", "FOMC", "金利据え置き"],
        "IMF・世界経済":           ["IMF", "世界経済", "景気後退", "リセッション", "GDP"],
        "円相場・為替":            ["円安", "円高", "為替", "ドル円"],
        "日本代表・W杯":           ["サッカー", "三笘", "W杯", "ワールドカップ", "日本代表"],
    }

    counter = Counter()
    for label, keywords in terms.items():
        counter[label] = sum(len(re.findall(kw, text)) for kw in keywords)

    return counter.most_common(20)


def main():
    year_month = sys.argv[1] if len(sys.argv) > 1 else "202604"
    results = aggregate_terms(year_month)

    print(f"\n{'='*50}")
    print(f"  {year_month[:4]}年{year_month[4:]}月 よく取り上げられた用語 TOP20")
    print(f"{'='*50}")
    for i, (label, count) in enumerate(results, 1):
        bar = "█" * min(count // 30, 30)
        print(f"{i:2}. {label:<20} {count:5}  {bar}")
    print()


if __name__ == "__main__":
    main()
