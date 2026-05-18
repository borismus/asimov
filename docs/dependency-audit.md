# Dependency audit — proposed missing edges

**Status:** authoring notes, not auto-applied. Each row below is a
direct, non-transitive predecessor → successor edge that is missing
from `static/asimov.tsv` as of last fetch. The “current deps” column
is what `Dependencies` already has on the successor card so you can
paste the addition straight into the sheet.

The corresponding `Dependencies` cells live in the Google Sheet (see
[stories.md](stories.md) for fetch flow); fix them there and re-run
`uv run scripts/fetch-tsv.py`. The site does **not** reduce transitive
edges at runtime, so adding a redundant ancestor will visibly clutter
the graph — keep edges direct.

## Method

- Parse `Dependencies` from `static/asimov.tsv` (column delimited by
  commas; predecessors point **into** the successor card).
- Compute the transitive closure (`ancestors(card)`) over those edges.
- A proposal `dep → target` is kept only if:
  - `dep` and `target` both exist as cards, and
  - `dep` is not already in `target.deps`, and
  - `dep` is not in `ancestors(target)` (i.e. not implied transitively).

The “currency → nations → writing” example: if `currency` already
depends on `nations` and `nations` already depends on `writing`, then
`currency → writing` is **redundant** and is rejected by this audit.

A reusable check script lives at `scripts/suggest-deps.py`. Add
candidates to its list and rerun — it labels each as `EXISTS`,
`TRANSITIVE`, `ANACHRON`, or `NEW`.

## Tier 0 — fill cards that currently have **no** deps

These cards declare zero predecessors but clearly should have some.
Filling them is the highest-leverage fix because they break the graph
into orphan subtrees.

| Successor | Add predecessor | Why |
|-----------|-----------------|-----|
| `cholera` | `quarantine`, `medicine` | Snow’s 1854 work is a medical / public-health response; `quarantine` already covers epidemic infrastructure. |
| `tissue-culture` | `antiseptic-surgery`, `pasteurization`, `microscope` | Carrel’s culture method depended on Listerian sterility and direct cell observation. |
| `population-growth-theory` | `mortality-tables` | Malthus relied on Graunt’s demographic tradition. |
| `nile-river` | `ocean-navigation`, `paved-road` | Bruce’s 1770 expedition is a transport/exploration achievement, not a vacuum. |
| `uniformitarianism` | `fossils`, `mineralogy` | Hutton built on the existing geology/fossil corpus. |
| `epinephrine` | `organic-synthesis`, `hemoglobin` | Takamine’s 1898 isolation needed mature extract-chemistry and protein/blood work. |
| `asparagine` | `chemical-elements` | Vauquelin / Robiquet (1806) needed Lavoisier-era analytical chemistry. |

## Tier 1 — clear mechanical / historical predecessors

| Successor | Add predecessor | Current deps | Why (direct, not transitive) |
|-----------|-----------------|--------------|------------------------------|
| `metal-stirrup` | `wooden-stirrup` | `steel`, `horse` | The metal version replaces an existing form; `steel` + `horse` don’t encode that. |
| `metal-stirrup` | `saddle` | `steel`, `horse` | Stirrups hang from saddle hardware. |
| `couched-lance` | `iron-horseshoes` | `metal-stirrup`, `high-backed-saddle` | Repeated shock charges need hoof protection; not implied by the seat/foot kit. |
| `miners-friend` | `pressure-cooker` | `air-pump`, `coal-mining` | Papin’s sealed-vessel work directly precedes Savery’s pump. |
| `germ-theory-of-disease` | `spontaneous-generation-rip` | `pasteurization`, `cholera` | Pasteur’s 1860 swan-neck experiment is the load-bearing prior step. |
| `industrial-revolution` | `steam-engine`, `coal-mining`, `coke-iron` | `spinning-frame` | Textile mechanization is one leg; the energy/metal stack is the other. |
| `gas-lighting` | `coal-mining` | `candle` | Early illuminating gas was distilled from coal; `coal-mining` is the fuel input. |
| `kerosene` | `distillation` | `gas-lighting` | Gesner distilled coal then petroleum into kerosene. |
| `jet-planes` | `steam-turbine` | `liquid-fuel-rockets`, `airplane` | Whittle’s jet is a gas turbine; the rocket lineage is parallel, not parent. |
| `diesel-engine` | `kerosene` | `gas-laws`, `high-pressure`, `four-stroke-engine` | Diesel’s engine ran on heavy oils; the fuel chain matters. |
| `photography` | `iodine` | `light-waves` | Daguerreotypes are silver-iodide chemistry; the optics dep alone misses the photochemistry. |
| `radio` | `morse-code`, `telegraph` | `radio-antennas` | Marconi sent dot-dash signals over Hertz waves; both telegraphy lineage and antennas are direct parents. |
| `radar` | `radio`, `radio-waves` | `spectral-line-shift`, `sonar` | Radar is pulsed-radio reflection; missing the radio lineage entirely. |
| `richter-scale` | `modern-seismograph` | `earthquakes` | Richter calibrated the 1880 Wiechert/Galitzin-style instrument, not the phenomenon. |
| `continental-drift` | `fossils`, `strata`, `mineralogy` | `amazon-river` | Wegener’s evidence was fossil distribution + rock-strata fit, not the Amazon basin per se. |
| `chemotherapy` | `bacterial-staining` | `chromatin` | Ehrlich came directly from differential dye-staining of bacteria. |
| `dna-as-genetic-material` | `pneumococcus`, `nucleic-acid` | `chromosome`, `heme`, `coenzyme`, `genes` | Avery 1944 = Griffith’s pneumococcus transformation + nucleic-acid chemistry. (See Tier 3 — `heme`/`coenzyme` look like sheet errors.) |
| `painless-childbirth` | `anesthesia`, `chloroform` | `screw-propeller` | Simpson 1847 used chloroform on obstetric patients; `screw-propeller` is almost certainly a sheet typo. (See Tier 3.) |

## Tier 2 — strong but slightly softer

| Successor | Add predecessor | Current deps | Why |
|-----------|-----------------|--------------|-----|
| `cart` | `animal-dom` | `copper` | Ox-drawn wagons (Bronocice ~3500 BCE, Mesopotamia) are the canonical case, but the earliest handcarts and wheelbarrows are human-powered — only add if the `cart` card means draft logistics. |
| `horse` | `cart` | `animal-dom` | Riding/chariot culture builds on the wheeled-transport tradition (story-aligned), but `horse → cart` is also defensible if the card is about horse-carts specifically. |
| `mach-number` | `doppler-effect` | `steam-locomotive-improved`, `aerodynamics` | Doppler’s acoustic work on moving trains is closer to Mach’s shock work than the locomotive itself. |
| `plutonism` | `earthquakes` | `earth-heat` | Hutton’s plutonism is the magmatic / volcanic / seismic family; current dep skips quakes. |
| `source-of-the-white-nile` | `ocean-navigation`, `scientific-voyages` | `nile-river` | Speke / Burton expeditions needed both the navigation tradition and the post-1700 scientific-exploration genre. |
| `rocky-mountains` | `scientific-voyages` | `america` | La Vérendrye / Mackenzie expeditions are scientific-voyage descendants, not just generic “America.” |
| `across-north-america` | `rocky-mountains` | `america` | Mackenzie / Lewis-Clark explicitly traversed the mountain barrier. |
| `helicopter` | `steam-turbine` | `airplane` | The Sikorsky era leaned on turboshaft / gas-turbine power, not just the fixed-wing tradition. |
| `iconoscope` | `triode` | `cathode-rays`, `oscilloscope` | Zworykin’s tube needs the amplifying-triode lineage, not just cathode-ray hardware. |
| `eniac` | `triode`, `symbolic-logic` | `computer` | ENIAC was thousands of vacuum tubes implementing Boolean logic; both direct parents missing. |
| `computer` | `symbolic-logic` | `analytical-engine`, `electromechanical-calculator` | Boolean / Turing logic is the missing leg next to the calculating tradition. |
| `transformer` | `alternating-currents` *(exists)* — but **`alternating-current-theory`** still needs `transformer` | `alternating-currents`, `imaginary-numbers` | Steinmetz’s theory was built around real transformer hardware, not just the phenomenon. |
| `first-automobile` | `macadamized-roads` | `steam-locomotive`, `four-stroke-engine`, `carriage-springs` | Benz/Daimler needed running surfaces; current deps cover engine + suspension but not the road. |
| `phase-contrast-microscope` | `microscope` | `electron-diffraction` | Zernike’s 1938 optic is an optical microscope variant; the EM lineage is wrong-family. |
| `perfusion-pump` | `antiseptic-surgery` | `tissue-culture` | Carrel-Lindbergh apparatus is a Listerian-sterility instrument. |
| `sutures` | `antiseptic-surgery` | `capillaries` | Murphy’s anastomosis assumes Listerian wound technique, not just vascular anatomy. |
| `biological-evolution` | `fossils` | `taxonomy` | Buffon’s 1749 transmutation hinted at fossil-deep-time, not just classification. |
| `evolution-by-natural-selection` | `biological-evolution`, `comparative-anatomy`, `mechanism-of-evolution` | `population-growth-theory` | Darwin synthesized all three threads with Malthus, not just Malthus. |
| `fertilization` | `plant-sexuality` | `no-spontaneous-generation` | Spallanzani’s 1779 fertilization work followed the plant-sex tradition directly. |
| `antitoxin` | `vaccination` | `diphtheria`, `tetanus` | Behring/Kitasato’s serum therapy is conceptually downstream of Jennerian inoculation, not just the two diseases. |
| `general-relativity` | `riemann-geometry` | `special-relativity`, `space-time` | The mathematical machinery is Riemannian curvature; currently only the physics legs are listed. |
| `second-law-of-thermodynamics → internal-combustion-engine` | `second-law-of-thermodynamics` | `kinetic-theory-of-gases`, `steam-engine-efficiency` | Otto-cycle theory needed Clausius-style entropy reasoning, not just Carnot duty. |
| `100-inch-telescope` | `reflecting-telescope` | `large-refracting-telescope` | A reflector descends from the reflector tradition; refractor is parallel. |
| `balloon-angioplasty` | `cardiac-catheter` | `coronary-bypass-surgery` | Gruentzig’s catheter-balloon is direct cath-lab evolution, not a bypass descendant. |

## Tier 3 — fix misleading / suspicious sole parents (data hygiene)

These rows look like sheet errors or pasted-wrong cells:

| Card | Current deps | Suggestion |
|------|--------------|------------|
| `painless-childbirth` | `screw-propeller` | **Almost certainly wrong.** Replace with `anesthesia`, `chloroform`. |
| `dna-as-genetic-material` | `chromosome, heme, coenzyme, genes` | `heme` and `coenzyme` are unrelated to Avery’s nucleic-acid work; replace with `pneumococcus`, `nucleic-acid` (keep `chromosome`, drop or replace the other two). |
| `nylon` | `silk-europe` | A 552 AD Byzantine sericulture event is not Carothers’ 1931 polymer. Add `organic-synthesis`, drop `silk-europe`. |
| `glycolysis` | `seebeck-effect` | Thermoelectric phenomena have nothing to do with sugar metabolism. Likely sheet typo — should be `metabolic-intermediate` or `gastric-digestion`. Investigate. |
| `interferometer` | `lines-of-force`, `light-waves`, `five-elements` | `five-elements` (Aristotle-era element theory) is a non-sequitur for Michelson’s 1881 instrument. Drop. |
| `ferments-and-enzymes` | `enzyme`, `mesmerism` | `mesmerism` (1774) has no connection to enzymology. Drop. |
| `vulcanization-of-rubber` | `specific-heat` | Goodyear’s discovery is sulfur cross-linking, not thermodynamics. Replace with `chemical-elements` or `organic-synthesis`. |
| `cart` | `copper` | Drop `copper` (bronze-age metallurgy ≠ wheeled logistics). If `cart` means ox-wagon, add `animal-dom`; if it means any wheeled platform, the only safe parent in the corpus is `wheel`, which doesn’t exist — leaving deps empty is more honest. |
| `smallpox-vaccine` | `epilepsy` | Drop — `epilepsy` routes only to `medicine` (humoral theory), which does not enable inoculation. No clean replacement exists in the corpus (no `smallpox`/`variolation` card). |
| `coal-mining` | `steel` | Reasonable for the industrial era; if you want mining-specific logic, there is no `pickaxe` card. Skip unless adding one. |
| `penicillin` | `lysozyme` | `lysozyme` already implies the long microbiology chain (`bacteria`, `microscope`, …). Fine as “Fleming lineage,” but don’t also add those — they’d be transitive. |
| `iodine` | `gunpowder` | Courtois extracted iodine from seaweed-ash during saltpeter production — defensible but indirect. Consider adding `chemical-elements` directly. |
| `nuclear-magnetic-resonance` | `electron-microscope`, `x-rays` | NMR is `magnetic-resonance` + `magnetic-moments` lineage, not EM/X-ray. Likely needs `magnetic-resonance` direct. |

## Deliberately not proposed

These are tempting but were rejected by the audit:

| Idea | Why skipped |
|------|-------------|
| `arquebus` → `gunpowder` | Transitive: `artillery` → `cannon` → `gunpowder`. |
| `musket` → `gunpowder` | Same (via `arquebus`). |
| `longbow` → `bow` | Already direct. |
| `crossbow` → `bow` | Already direct (added since the original audit). |
| `newcomen-steam-engine` → `boyles-law` | Transitive via `pressure-cooker`. |
| `air-pump` → `barometer` | **Already** `barometer` → `air-pump` — the existing edge points the right way. |
| `barometer` → `air-pump` | Wrong direction. |
| `germ-theory-of-disease` → `bacteria` | Transitive via `pasteurization` → `bacteria`. |
| `penicillin` → `bacteria` / `microorganisms` | Transitive via the `lysozyme` subtree. |
| `coal-mining` → `basic-steam-engine` | Narrative only; the Greek toy did not enable mining. |
| `puerperal-fever` → `germ-theory-of-disease` | Chronology — Semmelweis (1847) precedes germ theory (1862). |
| `newcomen-steam-engine` → `latent-heat` | **Wrong arrow.** Black (1761) discovered latent heat in a calorimetry/chemistry context, not from engine duty. The real influence runs **forward**: Black’s latent heat → Watt’s separate condenser (1765). The corpus’s `latent-heat → watt-steam-engine` already captures this; don’t add a backward edge. |
| `airplane` → `four-stroke-engine` | Transitive via `dirigible` → `four-stroke-engine`. |
| `radio-telescope` → `radio` | Transitive via `radio-waves-from-space` → `ionosphere` → `kennelly-heaviside-layer` → `radio`. |
| `photography` → `pluto` | Transitive via `asteroid-photography`. |
| `oil-wells` → `kerosene` | Wrong arrow (oil-wells 1859 > kerosene 1853). |
| `haber-process` → `nitrogen-fixation` | Wrong arrow. |
| `group-theory` → `no-quintic-equation` | Wrong arrow (group theory 1830 > Abel 1824). |
| `rubber-tire` → `bicycle` / `first-automobile` | Wrong arrow in both cases. |
| `kinetic-theory-of-gases` → `refrigerators` | Wrong arrow by one year (1859 > 1858). |
| Story-adjacent edges (e.g. `pike` → `longbow`) | Thematic neighbors, not prerequisites. Express in story `edge_note`, not `Dependencies`. |

## Suggested batching

- **Tier 0** (seven cards with empty deps) is the highest-impact first
  commit — these are graph orphans today.
- **Tier 1** (~18 edges + sheet fixes) is the cleanest second commit;
  every entry is mechanically or historically load-bearing.
- **Tier 2** is good follow-up.
- **Tier 3** is hygiene — best done as a separate sheet edit so the
  diff stays readable, and each row in Tier 3 is a **replacement**
  rather than an addition, which means more careful review.

After applying any subset, re-run `uv run scripts/fetch-tsv.py` and
then `python3 scripts/suggest-deps.py` to confirm the new edges are
no longer flagged as `NEW`.
