# Phenomena calibration: a subset of invention -> phenomenon links and the phenomenon cards
# themselves, for Boris to triage on the review sheet before rules are written.
#
#   python3 prototypes/assembly-cards/phenomena_calibration.py   # writes the two tabs as TSV
#
# Links: 11 drafted inventions (pilot and batch 1) chosen to cover the contested kinds, plus 20
# new ones drawn at random by type (10 objects, 5 materials, 5 practices; seed 20261113).
# Each row proposes "link" or "leave off" with a reason, so a tick or a comment says where the line is.
import csv, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# (invention, phenomenon card id or "no card: Name", kind, proposed, source, why)
LINKS = [
    # ---- drafted (pilot and batch 1) ----
    ("gps", "gravitational-red-shift", "effect", "link", "drafted", "Satellite clocks run fast in weaker gravity; without the correction positions drift by kilometres a day."),
    ("gps", "special-relativity", "theory", "link", "drafted", "Moving clocks run slow. A theory card, but the only card for time dilation by motion."),
    ("gps", "general-relativity", "theory", "leave off", "drafted", "The theory behind the red shift; the effect itself has its own card."),
    ("gps", "geometry", "math", "leave off", "drafted", "Trilateration is maths, not something in nature it works by."),
    ("gps", "radio-waves", "effect", "leave off", "drafted", "Comes through its part: the satellites' radios (Communications satellites)."),
    ("gps", "speed-of-light", "effect", "link", "new", "The receiver turns signal delay into distance because the signal travels at a known, fixed speed."),
    ("vitamin-pills", "vitamin-concept", "biology", "link", "drafted", "The body needs trace nutrients from food; the pills supply them."),
    ("vitamin-pills", "dietary-deficiency-diseases", "biology", "leave off", "drafted", "Same idea as Vitamin concept; fold into it."),
    ("vitamin-pills", "rickets", "disease", "leave off", "drafted", "A disease it prevents, not something it works by."),
    ("vitamin-pills", "scurvy", "disease", "leave off", "drafted", "A disease it prevents."),
    ("vitamin-pills", "pellagra", "disease", "leave off", "drafted", "A disease it prevents."),
    ("microchips", "binary-system", "math", "leave off", "drafted", "A number system the circuits implement: maths, not nature."),
    ("microchips", "symbolic-logic", "math", "leave off", "drafted", "Boolean logic is maths. The physics comes through its transistors."),
    ("stagecoach", "laws-motion", "law", "leave off", "drafted", "Everything that moves obeys them; too general to say anything about a stagecoach."),
    ("radio", "radio-waves", "effect", "link", "drafted", "It sends and receives them."),
    ("radio", "maxwells-equations", "theory", "leave off", "drafted", "The theory that predicted radio waves; the waves have their own card."),
    ("radio", "kennelly-heaviside-layer", "environment", "link", "drafted", "Long-distance radio works by bouncing off this layer of the atmosphere."),
    ("boiler", "latent-heat", "effect", "link", "drafted", "Water takes in a lot of heat to become steam, which is what the boiler stores and delivers."),
    ("boiler", "boyles-law", "law", "leave off", "drafted", "A gas law; fold into Gas laws. Saturated steam doesn't follow it anyway."),
    ("boiler", "combustion-and-phlogiston-theory-refinement", "chemistry", "leave off", "drafted", "Burning belongs to the fuel, not the vessel."),
    ("diesel-engine", "gas-laws", "law", "link", "drafted", "Compressing air heats it enough to ignite the fuel with no spark."),
    ("diesel-engine", "boyles-law", "law", "leave off", "drafted", "Fold into Gas laws."),
    ("diesel-engine", "high-pressure", "technique", "leave off", "drafted", "A card about reaching high pressures in the lab, not an effect."),
    ("diesel-engine", "steam-engine-efficiency", "theory", "leave off", "drafted", "Carnot's theory guided the design but isn't something the engine works by."),
    ("sail", "aerodynamics", "effect", "link", "drafted", "A sail is a wing: air flowing around it makes lift and drag."),
    ("sail", "trade-winds", "environment", "leave off", "drafted", "Where sailing ships go, not how a sail works."),
    ("transistor", "fermi-dirac-statistics", "theory", "leave off", "drafted", "Theory that explains semiconductors."),
    ("transistor", "current-and-crystals", "effect", "link", "new", "Braun found some crystals pass current one way: the semiconductor effect a transistor works by."),
    ("atomic-clock", "magnetic-resonance", "effect", "link", "drafted", "Atoms absorb at one exact frequency; the clock locks to it."),
    ("atomic-clock", "molecular-beams", "technique", "leave off", "drafted", "An experimental method, not an effect."),
    ("liquid-fuel-rockets", "conservation-momentum", "law", "link", "drafted", "Thrust is the momentum of the exhaust going the other way."),
    ("liquid-fuel-rockets", "laws-motion", "law", "leave off", "drafted", "Same thing as Conservation of momentum here, and too general."),
    ("liquid-fuel-rockets", "space-flight", "idea", "leave off", "drafted", "Tsiolkovsky's proposal that rockets could reach space: an idea, not an effect."),
    # ---- new: objects ----
    ("continuous-maser", "no card: Stimulated emission", "effect", "link", "new", "An excited atom hit by a photon emits an identical one. Masers and lasers work by it (3+ uses: earns a card)."),
    ("continuous-maser", "quantized-atom", "theory", "link", "new", "Atoms have discrete energy levels; the three-level scheme depends on them. Theory card, but the only one for energy levels."),
    ("adding-machine", "lever-math", "law", "leave off", "new", "Comes through its part, the gear train."),
    ("adding-machine", "decimal-notation", "math", "leave off", "new", "Carrying digits wheel to wheel follows positional notation: maths."),
    ("cat-scan", "x-rays", "effect", "link", "deck dependency", "Tissues absorb X-rays differently; the scanner measures that. Also on its Coolidge tube, but used here at its own level."),
    ("cat-scan", "fourier-analysis", "math", "leave off", "new", "The image reconstruction is maths."),
    ("jarvik-hearts", "air-pressure", "effect", "link", "new", "The Jarvik-7 was driven by pulses of compressed air through tubes from an outside console."),
    ("jarvik-hearts", "blood-circulation", "biology", "leave off", "new", "What it works on, not what it works by."),
    ("schmidt-camera", "refraction", "effect", "link", "new", "The corrector plate bends light to cancel the spherical mirror's aberration."),
    ("schmidt-camera", "optics", "effect", "leave off", "new", "Too broad; Light refraction is the specific effect."),
    ("schmidt-camera", "stellar-photography", "use", "leave off", "deck dependency", "What it's used for."),
    ("achromatic-lens", "light-spectrum", "effect", "link", "deck dependency", "Glass splits white light into colours; two glasses with different spread cancel it."),
    ("achromatic-lens", "refraction", "effect", "link", "new", "A lens works by bending light."),
    ("metal-stirrup", "laws-motion", "law", "leave off", "new", "Too general. No phenomenon at its own level: it has none."),
    ("ballpoint-pen", "no card: Capillary action", "effect", "link", "new", "Ink is drawn to the ball. Also fountain pen, candle and oil-lamp wicks (3+ uses: earns a card)."),
    ("ballpoint-pen", "universal-gravitation", "law", "leave off", "new", "Early ballpoints were gravity-fed, but gravity is too general."),
    ("paved-road", "(none)", "", "leave off", "new", "Nothing at its own level."),
    ("bow", "no card: Elasticity (Hooke's law)", "effect", "link", "new", "Stores energy by bending. Already a gap on Spring and Carriage springs: 3 uses, earns a card."),
    ("bow", "laws-motion", "law", "leave off", "new", "Too general."),
    # ---- new: materials ----
    ("bessemer-steel", "combustion-and-phlogiston-theory-refinement", "chemistry", "link", "new", "The air blast burns the excess carbon out of the iron. For a material: what happens in it, here while it's made."),
    ("pyroxylin", "no card: Nitration", "chemistry", "leave off", "new", "The reaction that makes it: production, like rule 4."),
    ("pyroxylin", "(none)", "", "leave off", "new", "Nothing it harnesses as a material."),
    ("vitamin-b-12-synthesis", "vitamin-concept", "biology", "link", "new", "The body needs it in trace amounts: what it does as a nutrient."),
    ("vitamin-b-12-synthesis", "pernicious-anemia", "disease", "leave off", "new", "A disease it treats."),
    ("vitamin-b-12-synthesis", "cyanocobalamin-structure", "knowledge", "leave off", "new", "Knowing the structure was needed to make it: production."),
    ("coal-mining", "combustion-and-phlogiston-theory-refinement", "chemistry", "link", "new", "A fuel's energy comes out by burning. Fuels carry combustion, not the engines that burn them."),
    ("coal-mining", "photosynthesis", "biology", "leave off", "new", "How coal formed long ago: origin, not use."),
    ("oil-wells", "combustion-and-phlogiston-theory-refinement", "chemistry", "link", "new", "Same as coal: what the fuel does."),
    ("oil-wells", "hydrostatics", "effect", "leave off", "new", "Pressure pushes oil up the well: extraction, which is production."),
    # ---- new: practices ----
    ("anesthesia", "hypnotism", "technique", "leave off", "deck dependency", "Not what anesthesia works by; ether and nitrous oxide carry the effect themselves."),
    ("electroencephalography", "electric-nerve-fibers", "biology", "link", "new", "Nerve signals are electrical; the brain's add up to waves on the scalp."),
    ("electroencephalography", "nerve-fibers", "biology", "leave off", "deck dependency", "Anatomy: what it records from, not the effect."),
    ("electroencephalography", "electrical-stimulation", "biology", "leave off", "new", "Galvani's frog legs: same idea as Electric nerve fibers, less specific."),
    ("tissue-culture", "cell-theory", "biology", "link", "new", "Cells are living units that can live on their own outside the body."),
    ("heart-transplants", "tissue-transplantation", "biology", "link", "new", "The body rejects foreign tissue; transplants work by managing that."),
    ("heart-transplants", "blood-circulation", "biology", "leave off", "new", "What it works on."),
    ("agriculture", "photosynthesis", "biology", "link", "new", "Crops grow by turning sunlight into food. Explained later (1779)."),
    ("agriculture", "plant-nourishment", "biology", "leave off", "new", "Same as Photosynthesis, earlier and vaguer."),
]

# The calls each calibration row asks about.
QUESTIONS = {
    "gps": "Effect over theory: the red shift, not General relativity. But Special relativity stays as the only card for time dilation by motion. OK as a stand-in?",
    "vitamin-pills": "Diseases left off: a disease is what an invention prevents or treats, not what it works by.",
    "microchips": "Maths and logic left off, even for computing. Its physics comes through its transistors.",
    "stagecoach": "Laws of motion left off everywhere as too general?",
    "radio": "Counts the environment (the ionosphere) when the invention works by it.",
    "boiler": "Combustion goes on the fuels (Coal mining, Oil wells, Gasoline), not on what burns them?",
    "diesel-engine": "Fold Boyle's and Charles's laws into Gas laws.",
    "sail": "Trade winds: where it's used, not how it works, so off?",
    "transistor": "Effect over theory: Current and crystals instead of Fermi-Dirac statistics.",
    "atomic-clock": "Experimental techniques (Molecular beams) left off.",
    "liquid-fuel-rockets": "Laws of motion folded into Conservation of momentum; Space flight (an idea) off.",
    "continuous-maser": "New card Stimulated emission (Masers, Continuous maser, Laser). Quantized atom as the only card for energy levels.",
    "adding-machine": "A part's phenomenon isn't repeated on the whole: the gear train has Lever mathematics.",
    "cat-scan": "But a phenomenon can be on both a part and the whole when both use it directly (X-rays here and on the Coolidge tube)?",
    "jarvik-hearts": "Biology it works on (blood circulation) is left off; the physics that drives it is in.",
    "schmidt-camera": "The specific effect over a broad field (Light refraction, not Optics).",
    "ballpoint-pen": "New card Capillary action (4 uses)? Gravity left off as too general.",
    "metal-stirrup": "Some cards have no phenomenon at their own level. Fine?",
    "paved-road": None,
    "bow": "Elasticity (Hooke's law) earns its card: Spring, Carriage springs, Bows and arrows.",
    "bessemer-steel": "For a material made by a reaction, does the reaction count? Here yes; for Pyroxylin, no (production). Which way?",
    "pyroxylin": "See Bessemer steel.",
    "vitamin-b-12-synthesis": "What a material does in the body counts (Vitamin concept); a disease it treats doesn't.",
    "coal-mining": "Fuels carry Combustion. How the coal formed is left off.",
    "oil-wells": "Extraction (reservoir pressure) left off as production.",
    "anesthesia": "A practice doesn't repeat its parts' phenomena: the effect lives on Nitrous oxide and Chloroform.",
    "electroencephalography": "Biology counts for practices. One card per effect: Electric nerve fibers over Galvani's Electrical stimulation.",
    "tissue-culture": None,
    "heart-transplants": "Rejection is something it has to overcome rather than use. Count it?",
    "agriculture": "Explained later: photosynthesis (1779) for an 8000 BCE practice.",
}

# The drafted phenomenon cards, the gaps, and new cards the draft above proposes.
# (card id or "no card: Name", kind, proposed, why)
CARDS = [
    ("acoustics", "effect", "keep", "Sound: how loudspeakers, telephones and sonar work."),
    ("aerodynamics", "effect", "keep", "Lift and drag."),
    ("air-pressure", "effect", "keep", "Air pushes; a vacuum sucks."),
    ("alternating-current-theory", "theory", "leave off", "Steinmetz's maths of AC circuits. Transformers work by Electromagnetism."),
    ("binary-system", "math", "leave off", "Maths."),
    ("black-bodies", "effect", "keep", "Hot things glow (light bulbs)."),
    ("boyles-law", "law", "fold into Gas laws", "One card for how gases behave."),
    ("cathode-rays", "effect", "keep", "Electrons streaming through a vacuum tube."),
    ("charged-cathode-rays", "effect", "fold into Cathode rays", "The same rays, shown to carry charge."),
    ("charles-law", "law", "fold into Gas laws", "One card for how gases behave."),
    ("combustion-and-phlogiston-theory-refinement", "chemistry", "keep", "Burning. Belongs on fuels."),
    ("conservation-momentum", "law", "keep", "Reaction thrust (rockets, jets, propellers)."),
    ("current-and-crystals", "effect", "keep", "The semiconductor effect."),
    ("decomposition-of-water", "chemistry", "fold into Laws of electrolysis", "Splitting water by current is electrolysis."),
    ("dietary-deficiency-diseases", "biology", "fold into Vitamin concept", "Same idea."),
    ("edison-effect", "effect", "keep", "Hot metal gives off electrons (vacuum tubes)."),
    ("electrical-conductance", "effect", "keep", "Some materials carry current."),
    ("electrical-motion", "effect", "keep", "Current in a magnetic field feels a force: the motor effect."),
    ("electricity-in-a-vacuum", "effect", "keep", "Glow discharge in low-pressure gas."),
    ("electromagnetism", "effect", "keep", "Current makes a magnetic field; a changing field makes current."),
    ("electron-emission", "effect", "fold into Edison effect", "Richardson's thermionic emission is the same effect."),
    ("fermi-dirac-statistics", "theory", "leave off", "Theory that explains semiconductors; Current and crystals is the effect."),
    ("fourier-analysis", "math", "leave off", "Maths."),
    ("gas-laws", "law", "keep", "How gases respond to heat and pressure. Takes Boyle's and Charles's laws."),
    ("general-relativity", "theory", "leave off", "Theory; Gravitational red shift is the effect."),
    ("geometry", "math", "leave off", "Maths."),
    ("gravitational-red-shift", "effect", "keep", "Clocks run at different rates in different gravity."),
    ("high-pressure", "technique", "leave off", "Reaching high pressures in the lab, not an effect."),
    ("hydrostatics", "effect", "keep", "Buoyancy and fluid pressure."),
    ("kennelly-heaviside-layer", "environment", "keep", "Bounces radio waves around the Earth."),
    ("latent-heat", "effect", "keep", "Heat taken in or given off when water boils or steam condenses."),
    ("laws-motion", "law", "leave off", "Too general: everything that moves obeys them."),
    ("laws-of-electrolysis", "chemistry", "keep", "Current drives chemical reactions and reactions drive current (batteries)."),
    ("lever-math", "law", "keep", "Mechanical advantage."),
    ("magnetic-moments", "effect", "keep", "Atoms are tiny magnets (permanent magnets)."),
    ("magnetic-resonance", "effect", "keep", "Atoms and nuclei absorb at exact frequencies."),
    ("maxwells-equations", "theory", "leave off", "Theory; Radio waves is the effect."),
    ("molecular-beams", "technique", "leave off", "An experimental method."),
    ("ohms-law", "law", "keep", "Resistance: how much current a voltage drives."),
    ("particles-as-waves", "effect", "keep", "Electrons behave as waves (tunnelling)."),
    ("pellagra", "disease", "leave off", "A disease."),
    ("photoelectric-effect", "effect", "keep", "Light knocks electrons loose."),
    ("piezoelectricity", "effect", "keep", "Squeezed crystals make voltage, and the reverse."),
    ("platinum-as-catalyst", "chemistry", "fold into Catalysis", "Catalysis is the deck's general card (1812)."),
    ("positive-negative-charge", "effect", "keep", "Static charge."),
    ("radio-waves", "effect", "keep", "Radio waves."),
    ("rickets", "disease", "leave off", "A disease."),
    ("scurvy", "disease", "leave off", "A disease."),
    ("space-flight", "idea", "leave off", "A proposal, not an effect."),
    ("special-relativity", "theory", "keep", "Theory, but the only card for time dilation by motion (GPS)."),
    ("spectral-lines", "effect", "keep", "Each element emits its own colours (neon lights)."),
    ("speed-of-light", "effect", "keep", "Light and radio travel at a fixed, known speed (radar, GPS)."),
    ("steam-engine-efficiency", "theory", "leave off", "Carnot's theory of heat engines."),
    ("symbolic-logic", "math", "leave off", "Maths."),
    ("trade-winds", "environment", "leave off", "Geography: where ships sail, not how they work."),
    ("universal-gravitation", "law", "keep", "Orbits (satellites)."),
    ("vitamin-concept", "biology", "keep", "The body needs trace nutrients."),
    ("waves-as-particles", "effect", "keep", "Light comes in photons (LEDs)."),
    ("x-rays", "effect", "keep", "Penetrating radiation."),
    ("no card: Elasticity (Hooke's law)", "effect", "new card", "Spring, Carriage springs, Bows and arrows: 3 uses."),
    ("no card: Rolling friction", "effect", "leave off", "Only Ball bearing so far."),
    ("no card: Stimulated emission", "effect", "new card", "Masers, Continuous maser, Laser: 3 uses."),
    ("no card: Capillary action", "effect", "new card", "Ballpoint pen, Fountain pen, Candles, Oil lamps: 4 uses."),
    ("catalysis", "chemistry", "keep", "Takes Platinum as catalyst (fuel cell); also catalytic materials."),
    ("refraction", "effect", "keep", "Light bends entering glass: every lens."),
    ("light-spectrum", "effect", "keep", "Glass splits white light into colours."),
    ("photosynthesis", "biology", "keep", "Plants turn light into food (agriculture)."),
    ("cell-theory", "biology", "keep", "Cells are living units (tissue and virus culture)."),
    ("tissue-transplantation", "biology", "keep", "The body rejects foreign tissue (transplants)."),
    ("electric-nerve-fibers", "biology", "keep", "Nerve signals are electrical (EEG, ECG, pacemaker)."),
    ("quantized-atom", "theory", "keep", "Theory, but the only card for energy levels (masers, lasers)."),
]

if __name__ == '__main__':
    sys.path.insert(0, HERE)
    from lists import TYPES, NEW_CARDS
    rows = {r['ID']: r for r in csv.DictReader(open(os.path.join(HERE, '..', '..', 'static', 'asimov.tsv')), delimiter='\t')}
    title = lambda i: i[len('no card: '):] if i.startswith('no card: ') else i if i == '(none)' else NEW_CARDS[i][0] if i in NEW_CARDS else rows[i]['Title']
    for inv, ph, *_ in LINKS:
        assert inv in TYPES, inv
        assert ph.startswith('no card: ') or ph == '(none)' or ph in rows, ph
    out = os.environ.get('OUT', '.')
    with open(os.path.join(out, 'links.tsv'), 'w') as f:
        w = csv.writer(f, delimiter='\t', lineterminator='\n')
        w.writerow(['Invention', 'Type', 'Year', 'Phenomenon', 'Card', 'Kind', 'Proposed', 'Source', 'Why', 'Looks right', 'Comment', 'Changed'])
        for inv, ph, kind, prop, src, why in LINKS:
            card = 'no card' if ph.startswith('no card: ') else '' if ph == '(none)' else rows[ph]['Year']
            w.writerow([title(inv), TYPES[inv], rows[inv]['Year'] if inv in rows else NEW_CARDS[inv][1], title(ph), card, kind, prop, src, why, 'FALSE', '', ''])
    with open(os.path.join(out, 'cards.tsv'), 'w') as f:
        w = csv.writer(f, delimiter='\t', lineterminator='\n')
        w.writerow(['Phenomenon', 'Year', 'Kind', 'Proposed', 'Why', 'Looks right', 'Comment', 'Changed'])
        for ph, kind, prop, why in CARDS:
            w.writerow([title(ph), '' if ph.startswith('no card: ') else rows[ph]['Year'], kind, prop, why, 'FALSE', '', ''])
    print(len(LINKS), 'links,', len({l[0] for l in LINKS}), 'inventions;', len(CARDS), 'cards')

    # The two review-sheet tabs, as rows of cells (JSON), one row per invention and one per card.
    import json
    from collections import OrderedDict
    by = OrderedDict()
    for inv, ph, kind, prop, src, why in LINKS:
        by.setdefault(inv, []).append((ph, kind, prop, src, why))
    calib = [["Looks right", "Invention", "Phenomena (+ link, ✗ leave off)", "My questions", "Your comment", "Changed", "Type", "Year", "Drafted before"]]
    for inv, items in by.items():
        lines = []
        for ph, kind, prop, src, why in items:
            if ph == '(none)':
                lines.append('(none) ' + why); continue
            name = title(ph) + (' (no card)' if ph.startswith('no card: ') else '')
            k = f' [{kind}]' if kind else ''
            lines.append(f"{'+' if prop == 'link' else '✗'} {name}{k}: {why}")
        year = rows[inv]['Year'] if inv in rows else NEW_CARDS[inv][1]
        drafted = 'yes' if any(src == 'drafted' for _, _, _, src, _ in items) else 'no'
        calib.append([False, title(inv), "\n".join(lines), QUESTIONS.get(inv), None, None, TYPES[inv], "'" + year, drafted])
    sections = [("keep", "KEEP: effects and laws inventions work by"), ("fold", "FOLD INTO ANOTHER CARD"),
                ("leave off", "LEAVE OFF: maths, theory, techniques, ideas, diseases, geography"),
                ("new card", "NEW CARDS: phenomena with no card that 3 or more inventions use"),
                ("added", "DECK CARDS THE NEW DRAFTS BRING IN")]
    import lists
    drafted_ids = {p for v in lists.PHEN.values() for p in v if not isinstance(p, tuple)}
    def section(ph, prop):
        if prop == 'new card' or (ph.startswith('no card: ') and prop == 'leave off'): return 'new card'
        if ph not in drafted_ids and not ph.startswith('no card: '): return 'added'
        return 'fold' if prop.startswith('fold') else prop
    cards = [["Looks right", "Phenomenon", "Proposal", "Why", "Your comment", "Changed", "Kind", "Year"]]
    headers = []
    for key, label in sections:
        headers.append(len(cards) + 1)
        cards.append([None, label, None, None, None, None, None, None])
        for ph, kind, prop, why in CARDS:
            if section(ph, prop) != key: continue
            cards.append([False, title(ph), prop, why, None, None, kind, '' if ph.startswith('no card: ') else "'" + rows[ph]['Year']])
    json.dump({"calib": calib, "cards": cards, "card_headers": headers}, open(os.path.join(out, 'tabs.json'), 'w'), ensure_ascii=False)
    print('calibration rows', len(calib) - 1, '; card rows', len(cards) - 1, 'headers at', headers)
