# Daily editorial cartoon

The separate Editorial Cartoon workflow runs after Daily News Update finishes, and verifies successful normal-page and paper-edition generation. News collection and selection are unchanged; the news workflow also copies the optional cartoon assets into its Pages artifact. It reads only the five summary2.txt sections from 重要ニュース through その他ニュース. GPT explores five distinct stories, then a separate comparison evaluates factual contradiction, visual clarity, small-column readability, grounding and novelty. Deterministic weighted scoring selects a ranked shortlist of three; candidate 1 becomes a monochrome pen-and-ink cartoon for English-speaking readers. The drawing prompt strongly references Georges Bigot, Charles Wirgman and Charles Keene, with expressive human caricature, varied contours and sparse hatching. The PNG is 816 × 816 (smallest supported square). Its Japanese title is HTML text below the image, at the bottom of the normal edition, at 50% of the content width. The paper edition shows the same cartoon in a one-column square frame below the first two important-news tiers, with its Japanese title in a separate caption underneath. All 20 important stories remain; Others displays one fewer row (12 → 9), and the comment ranking adds as many headlines as fit above the A4 bottom margin. `node newspaper/paper-layout.test.mjs` verifies image loading, retained article counts and a single A4 print page using Playwright.

## Enable

Set repository **Settings → Secrets and variables → Actions → New repository secret → OPENAI_API_KEY** to an OpenAI API key with image-generation access and API billing enabled. The existing GEMINI_API_KEY is not used for this feature. Run **Editorial Cartoon → Run workflow**, or wait for the next scheduled news update.

Optional Actions variables:

- CARTOON_TEXT_MODEL: default gpt-5-mini
- CARTOON_IMAGE_MODEL: default gpt-image-2.5-flare (must support custom 816x816 PNG output)

The five explored ideas, all comparison scores, the three ranked ideas, selection reason, title and prompt are saved in editorial-cartoon.json. The image is editorial-cartoon.png. The prompt limits in-image lettering to zero or one large bubble/label (at most three words, 14 characters), and uses only two main figures and one prop. Titles are enclosed in Japanese corner brackets. Identical news content and design settings reuse the saved image without API calls. API errors leave the last successful image intact and do not block news publication. Its generation date remains visible. Image requests are not automatically retried after ambiguous errors.

Validation: `node --test cartoon/cartoon.test.mjs` uses mocked API responses without spending credits. Actual generation: `node cartoon/generate.mjs`, then `node cartoon/publish.mjs`.

## Image archive

`picturewarehohuse/` accumulates cartoon PNGs named `YYYY-MM-DD_日本語の題名.png`. The workflow runs `node cartoon/archive.mjs` after generation and commits the archive alongside the latest image. Identical images are not duplicated. If a redraw shares the same date and title, a short content hash is appended to retain both drawings. Unsafe filename characters are replaced with underscores. News programs and the displayed image paths are unchanged.

Selection weights: contradiction 4, visual clarity 3, small-format readability 2, factual grounding 1, novelty 1 (each dimension scored 0–5). Ideas with grounding below 3 or contradiction/visual clarity below 2 are excluded; fewer than three qualifying ideas preserves the previous cartoon. Seriousness or prominence alone is not satire. The last published composition and seven recent archive titles inform variety. Existing images are reused for unchanged news; the new selection process applies to the next new edition.
