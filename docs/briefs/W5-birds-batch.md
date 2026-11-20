# Wave 5d · Technical Artists · bird conversion batches · tag ART

Read W5-common.md first. Then read the art docs:
- `docs/art/style-guide.md` §8 and §11;
- D-ART-009, D-ART-010 (how to convert a bird) and D-ART-011 (pipeline v2.1 and the **batch checklist**).

Look at the three converted birds before you start: Peacock, Swift and Cassowary in `src/client/render/models/bodies.ts`
and `birds-a3.ts`/`birds-b2.ts`, and their renders. They are the bar, an honest 3 out of 4 from the player camera. Beat
it if you can. The user's words: "incredible attention to detail in model design… no placeholder cuboids etc it should
all look incredible". The close-up reference frame `HP8-yBieQK8\t2010.jpg` is in
`C:\Users\AlexNortham\Documents\game\out\reference\` (read-only, never committed).

## The batches (three artists in parallel)

| Batch | Birds | Builder files |
|---|---|---|
| A | Vulture, Hummingbird, Toucan, Woodpecker, Nightjar, **plus the shared shader fix below** | `birds-a3.ts`, `birds-b2.ts` |
| B | Albatross, Kingfisher, Lyrebird, Shrike, Flamingo, Hornbill | `heroes.ts`, and `heroes-b.ts` for Flamingo and Hornbill |
| C | Owl, Pelican, Penguin, Puffin, Secretarybird, Starling | `heroes-b.ts` |

**Shared files.**
- `bodies.ts`: add your birds' anchors and bodies as separate functions, and add your entries to `BODIES` on their own
  lines, so the merges stay clean.
- `bird-material.ts`, `anatomy.ts`, `feathers.ts`, `sdf.ts`, `mesher.ts` and `skin.ts`: **Batch A only.** If B or C
  needs a shared change, say so in your report and the EP routes it.

**Shared shader fix (Batch A, first):**
- The v2.1 feather surface shows dotted, aliased black edge speckle along feather edges at distance. It's visible on the
  Peacock's neck from behind. Filter it properly (mips, derivative-based edge width, or a fade with distance), not by
  blurring detail away.
- Then measure the feather shader's cost on the reference iGPU at Medium and Low, and keep within the frame budget.

## Each bird

Follow D-ART-010 and every item on the D-ART-011 checklist. Then check the bird:
- the triptych (three-quarter, front, back from the player camera) under neutral light;
- one in-game front and back view under the golden-hour renderer;
- the 10, 40 and 80 m line-up for distance readability;
- the attachment tests (guns held, never floating: D-EP-035);
- every budget: hero bird with gun ≤ 9,000 / 3,500 / 1,200 / 400 triangles, ≤ 3 draw calls.

Commit each bird separately.

**Keep each bird's identity.** The hero's kit and silhouette in its GDD entry and in the style guide's §8 table come
first; don't make them generic. Copy nothing from the reference game (D-EP-002).

## Done means

- Every bird in your batch scores an honest 3 or better from the player camera. Show your scores in a STATUS table, with
  the image paths.
- `npm run check` passes, apart from the known failures named in your prompt.
- Reply in at most 150 words: branch, last commit, scores, and anything left.

Others working in parallel: the other two batches, Bot AI and the integration engineer. Don't edit their files.
