# Daily editorial cartoon

The separate Editorial Cartoon workflow runs after Daily News Update finishes, and verifies successful normal-page and paper-edition generation. News collection and selection are unchanged; the news workflow also copies the optional cartoon assets into its Pages artifact. It reads only the five summary2.txt sections from 重要ニュース through その他ニュース. GPT ranks three distinct stories; candidate 1 becomes a monochrome pen-and-ink cartoon for English-speaking readers. The drawing prompt strongly references Georges Bigot, Charles Wirgman and Charles Keene, with expressive human caricature, varied contours and sparse hatching. The PNG is 1536 × 1152 (width:height 4:3). Its Japanese title is HTML text below the image, at the bottom of the normal edition, at 50% of the content width. The paper edition shows the same cartoon in a two-column frame below the first two important-news tiers, with its Japanese title in a separate caption underneath. All 20 important stories remain; Others displays one fewer row (12 → 9), and the comment ranking uses half the headlines that fit. `node newspaper/paper-layout.test.mjs` verifies image loading, retained article counts and a single A4 print page using Playwright.

## Enable

Set repository **Settings → Secrets and variables → Actions → New repository secret → OPENAI_API_KEY** to an OpenAI API key with image-generation access and API billing enabled. The existing GEMINI_API_KEY is not used for this feature. Run **Editorial Cartoon → Run workflow**, or wait for the next scheduled news update.

Optional Actions variables:

- CARTOON_TEXT_MODEL: default gpt-5-mini
- CARTOON_IMAGE_MODEL: default gpt-image-2.5-flare (must support custom 1536x1152 PNG output)

The three ranked ideas, selection reason, title and prompt are saved in editorial-cartoon.json. The image is editorial-cartoon.png. Identical news content reuses the saved image without API calls. API errors leave the last successful image intact and do not block news publication. Its generation date remains visible. Image requests are not automatically retried after ambiguous errors.

Validation: `node --test cartoon/cartoon.test.mjs` uses mocked API responses without spending credits. Actual generation: `node cartoon/generate.mjs`, then `node cartoon/publish.mjs`.
