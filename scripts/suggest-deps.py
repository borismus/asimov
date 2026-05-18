#!/usr/bin/env python3
"""
Check candidate predecessor → successor edges against the current TSV.

For each (dep, target) pair, report:
  - whether both cards exist
  - whether the edge is already present
  - whether dep ∈ ancestors(target) (transitively implied — would be redundant)
  - what target's current deps are (for context)

Run: `uv run scripts/suggest-deps.py` (or `python3 scripts/suggest-deps.py`).
"""

import csv
import sys
from collections import defaultdict

TSV = "static/asimov.tsv"

def load():
    rows = list(csv.reader(open(TSV), delimiter="\t"))
    hdr = rows[0]
    ID = hdr.index("ID"); YR = hdr.index("Year"); DEP = hdr.index("Dependencies")
    cards = {}
    for r in rows[1:]:
        if len(r) <= max(ID, YR, DEP): continue
        cid = r[ID].strip()
        if not cid: continue
        deps = [d.strip() for d in r[DEP].split(",") if d.strip()]
        try: year = int(r[YR])
        except: year = None
        cards[cid] = {"year": year, "deps": deps}
    return cards

def ancestors(cards, cid, seen=None):
    if seen is None: seen = set()
    for d in cards.get(cid, {}).get("deps", []):
        if d in seen: continue
        seen.add(d)
        ancestors(cards, d, seen)
    return seen

def check(cards, candidates):
    print(f"{'verdict':<10} {'dep':<32} → {'target':<32} {'note'}")
    print("-" * 100)
    for dep, target in candidates:
        if target not in cards:
            v = "NO_TARGET"; note = ""
        elif dep not in cards:
            v = "NO_DEP"; note = ""
        elif dep in cards[target]["deps"]:
            v = "EXISTS"; note = ""
        elif dep in ancestors(cards, target):
            v = "TRANSITIVE"; note = f"via existing deps {cards[target]['deps']}"
        else:
            v = "NEW"
            ty = cards[target].get("year"); dy = cards[dep].get("year")
            note = f"target={ty} dep={dy} current={cards[target]['deps']}"
            if dy is not None and ty is not None and dy > ty:
                v = "ANACHRON"
                note = f"dep year {dy} > target year {ty} — wrong arrow"
        print(f"{v:<10} {dep:<32} → {target:<32} {note}")

if __name__ == "__main__":
    cards = load()
    # Candidate pool — extend freely.
    candidates = [
        # Tier-1 already proposed (sanity checks)
        ("wooden-stirrup", "metal-stirrup"),
        ("saddle", "metal-stirrup"),
        ("iron-horseshoes", "couched-lance"),
        ("pressure-cooker", "miners-friend"),
        ("spontaneous-generation-rip", "germ-theory-of-disease"),

        # Industrial / transport
        ("four-stroke-engine", "airplane"),
        ("internal-combustion-engine", "airplane"),
        ("improved-steam-engine", "industrial-revolution"),
        ("steam-engine", "industrial-revolution"),
        ("coal-mining", "industrial-revolution"),
        ("coal-mining", "gas-lighting"),
        ("distillation", "kerosene"),
        ("oil-wells", "internal-combustion-engine"),
        ("steam-turbine", "jet-planes"),
        ("morse-code", "radio"),
        ("radio", "radar"),
        ("radio-waves", "radar"),
        ("radio", "radio-telescope"),

        # Photography / optics
        ("optics", "photography"),
        ("iodine", "photography"),
        ("silver-fillings", "photography"),  # silver chemistry
        ("photography", "pluto"),
        ("photography", "asteroids"),
        ("camera-obscura", "photography"),  # probably not in corpus

        # Geology / earth sciences
        ("modern-seismograph", "richter-scale"),
        ("fossils", "continental-drift"),
        ("mineralogy", "continental-drift"),
        ("strata", "continental-drift"),
        ("fossils", "uniformitarianism"),
        ("mineralogy", "uniformitarianism"),
        ("earthquakes", "plutonism"),

        # Bio / medicine
        ("synthetic-dyes", "chemotherapy"),
        ("bacterial-staining", "chemotherapy"),
        ("antiseptic-surgery", "tissue-culture"),
        ("pasteurization", "tissue-culture"),
        ("microscope", "tissue-culture"),
        ("quarantine", "cholera"),
        ("medicine", "cholera"),
        ("mortality-tables", "population-growth-theory"),
        ("organic-synthesis", "epinephrine"),
        ("hemoglobin", "epinephrine"),  # extract chemistry
        ("organic-synthesis", "asparagine"),
        ("chemical-elements", "asparagine"),
        ("synthetic-urea", "asparagine"),  # synth-urea is 1828, asparagine 1806 — anachron
        ("smallpox-vaccine", "smallpox-eradication"),  # sanity (already present)
        ("pneumococcus", "dna-as-genetic-material"),
        ("nucleic-acid", "dna-as-genetic-material"),
        ("chromosome", "dna-as-genetic-material"),  # already present
        ("antiseptic-surgery", "surgical-gloves"),  # already present
        ("filtrable-virus", "aids"),
        ("virus-genome", "aids"),
        ("retroviruses", "aids"),
        ("reverse-transcriptase", "aids"),

        # Geography / exploration
        ("ocean-navigation", "nile-river"),
        ("scientific-voyages", "nile-river"),
        ("paved-road", "nile-river"),

        # Astronomy
        ("100-inch-telescope", "schmidt-camera"),  # already present
        ("photography", "discovery-of-ceres"),  # too early
        ("doppler-effect", "mach-number"),

        # Math / logic
        ("calculus", "fourier-analysis"),  # already present
        ("probability", "mortality-tables"),  # already present

        # Chemistry
        ("oxygen", "ozone"),  # already present
        ("petroleum", "diesel-engine"),  # not in corpus
        ("kerosene", "diesel-engine"),

        # Self-checks (should be EXISTS or TRANSITIVE)
        ("animal-dom", "horse"),  # exists
        ("animal-dom", "cart"),  # already discussed

        # === Additional sweep ===

        # Geography / exploration
        ("compass", "africa-coast"),
        ("ocean-navigation", "source-of-the-white-nile"),
        ("scientific-voyages", "source-of-the-white-nile"),
        ("scientific-voyages", "amazon-river"),
        ("scientific-voyages", "rocky-mountains"),
        ("greenland-ice-cap", "arctic-ocean"),  # already
        ("rocky-mountains", "across-north-america"),

        # Industrial / chemistry
        ("petroleum-distillation", "kerosene"),  # not in corpus
        ("oil-wells", "kerosene"),  # anachron
        ("haber-process", "nitrogen-fixation"),  # reverse?
        ("coke-iron", "industrial-revolution"),
        ("flying-shuttle", "industrial-revolution"),
        ("paved-road", "first-automobile"),
        ("macadamized-roads", "first-automobile"),
        ("rubber-tire", "first-automobile"),  # 1885 first auto, 1887 rubber-tire — anachron
        ("rubber-tire", "bicycle"),
        ("internal-combustion-engine", "first-automobile"),
        ("four-stroke-engine", "first-automobile"),  # already
        ("internal-combustion-engine", "dirigible"),

        # Electricity / radio chain
        ("electric-motors", "self-starter"),  # exists
        ("electric-light", "tungsten-wire"),  # exists
        ("electric-generators", "alternating-currents"),
        ("transformer", "alternating-current-theory"),
        ("electromagnets", "telegraph"),  # exists
        ("telegraph", "telephone"),
        ("telegraph", "radio"),
        ("kennelly-heaviside-layer", "ionosphere"),  # exists

        # Aviation
        ("internal-combustion-engine", "airplane"),  # transitive
        ("aerodynamics", "airplane"),
        ("steam-turbine", "helicopter"),
        ("internal-combustion-engine", "helicopter"),
        ("internal-combustion-engine", "submarine"),  # exists
        ("aerodynamics", "supersonic-flight"),
        ("jet-planes", "supersonic-flight"),

        # Computing
        ("symbolic-logic", "computer"),
        ("symbolic-logic", "eniac"),
        ("vacuum-tube", "eniac"),  # no such card
        ("triode", "eniac"),
        ("transistor", "microchips"),
        ("triode", "iconoscope"),

        # Imaging / optics
        ("cathode-rays", "iconoscope"),  # exists
        ("light-as-wave", "holography"),
        ("light-diffraction", "holography"),
        ("microscope", "phase-contrast-microscope"),
        ("microscope", "electron-microscope"),  # exists

        # Bio / genetics
        ("synthetic-dyes", "bacterial-staining"),
        ("antiseptic-surgery", "perfusion-pump"),
        ("antiseptic-surgery", "sutures"),
        ("blood-color", "blood-types"),  # exists
        ("blood-types", "tissue-transplantation"),  # exists
        ("germ-theory-of-disease", "puerperal-fever"),  # rejected — chronology
        ("microorganisms", "germ-theory-of-disease"),  # transitive via pasteurization
        ("plant-species-classified", "biological-evolution"),
        ("animal-classification", "biological-evolution"),
        ("fossils", "biological-evolution"),
        ("comparative-anatomy", "evolution-by-natural-selection"),
        ("biological-evolution", "evolution-by-natural-selection"),
        ("mechanism-of-evolution", "evolution-by-natural-selection"),
        ("plant-sexuality", "fertilization"),
        ("pasteurization", "germ-theory-of-disease"),  # exists
        ("smallpox-vaccine", "rabies"),
        ("vaccination", "antitoxin"),
        ("anthrax-inoculation", "rabies"),  # exists
        ("smallpox-eradication", "vaccination"),  # backwards
        ("synthetic-dyes", "chromatin"),  # bact-staining is dyes
        ("microscope", "bacteria"),
        ("microscope", "bacilli"),  # exists
        ("microscope", "cell"),  # exists
        ("microscope", "cell-theory"),
        ("optics", "microscope"),  # via eyeglass

        # Math
        ("non-euclidean-geometry", "riemann-geometry"),  # exists
        ("riemann-geometry", "general-relativity"),
        ("group-theory", "no-quintic-equation"),  # reverse — group theory came after Abel
        ("symbolic-logic", "venn-diagram"),  # exists

        # Steam / power
        ("watt-steam-engine", "improved-steam-engine"),  # no such card
        ("steam-engine", "improved-steam-engine"),  # exists
        ("conservation-of-energy", "steam-engine-efficiency"),
        ("kinetic-theory-of-gases", "internal-combustion-engine"),  # exists
        ("steam-engine-efficiency", "second-law-of-thermodynamics"),  # exists
        ("second-law-of-thermodynamics", "internal-combustion-engine"),
        ("turbines", "steam-turbine"),  # exists

        # Photography
        ("light-as-wave", "photography"),
        ("optics", "photography"),  # transitive

        # Astronomy
        ("photography", "asteroid-photography"),  # exists
        ("photography", "stellar-photography"),
        ("photography", "nebular-photography"),  # exists via dry-plates
        ("dry-plates", "stellar-photography"),
        ("100-inch-telescope", "hubble-space-telescope"),  # exists
        ("reflecting-telescope", "100-inch-telescope"),

        # Medicine
        ("cardiac-catheter", "balloon-angioplasty"),
        ("artificial-heart-implant", "jarvik-hearts"),  # exists
        ("microscope", "blood-types"),  # exists
        ("germ-theory-of-disease", "antiseptic-surgery"),  # exists
        ("anesthesia", "antiseptic-surgery"),  # exists
        ("anesthesia", "painless-childbirth"),
        ("chloroform", "painless-childbirth"),

        # Refrigeration / fridge
        ("liquefying-gases", "refrigerators"),  # exists
        ("kinetic-theory-of-gases", "refrigerators"),
    ]
    check(cards, candidates)
