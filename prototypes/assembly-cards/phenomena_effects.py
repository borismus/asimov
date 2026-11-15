# Phenomena, round 2: the effect goes on the link. A phenomenon link is an effect plus the card
# that describes it, the way a part is a job plus the card that does it:
#
#   provides power -> Steam engine          (a part)
#   lift           -> Aerodynamics          (a phenomenon)
#
# This file holds the effect vocabulary, the calibration rows revised after Boris's triage of
# the "Phenomena calibration" tab, and a mapping of the drafted links (pilot and batch 1) onto
# effects, so every effect can show who uses it. The own-level rule is applied by code: a link
# is dropped when one of the invention's parts (at any depth) already has the same effect.
#
#   OUT=<dir> python3 prototypes/assembly-cards/phenomena_effects.py   # writes effects.json
import collections, csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# effect -> card id, or "no card: Name" (a gap, or a new card at 3+ uses)
EFFECTS = {
    # mechanics and fluids
    "mechanical advantage": "lever-math",
    "rolling friction": "rolling-friction",
    "elasticity": "hookes-law",
    "reaction thrust": "conservation-momentum",
    "orbit": "universal-gravitation",
    "lift": "aerodynamics",
    "drag": "aerodynamics",
    "buoyancy": "archimedes-principle",
    "atmospheric pressure": "air-pressure",
    "compressed gas pushes back": "boyles-law",
    "heating a gas expands it": "charles-law",
    "compressing a gas heats it": "gas-laws",
    "latent heat": "latent-heat",
    "capillary action": "capillary-action",
    "sound echoes": "acoustics",
    "water pressure grows with depth": "hydrostatics",
    # electricity and magnetism
    "static charge": "positive-negative-charge",
    "conduction": "electrical-conductance",
    "resistance": "ohms-law",
    "pressure changes carbon's resistance": "no card: Contact resistance",
    "a reaction drives a current": "laws-of-electrolysis",
    "a current makes a magnet": "electromagnetism",
    "a magnet pushes a current": "electrical-motion",
    "induction": "electromagnetic-induction",
    "atoms are tiny magnets": "magnetic-moments",
    "radio waves": "radio-waves",
    "the ionosphere reflects radio": "kennelly-heaviside-layer",
    "signal delay gives distance": "speed-of-light",
    # electrons, light and atoms
    "thermionic emission": "edison-effect",
    "electron beams": "cathode-rays",
    "gas glows when current passes": "electricity-in-a-vacuum",
    "each gas glows its own colours": "spectral-lines",
    "hot things glow": "black-bodies",
    "one-way conduction in crystals": "current-and-crystals",
    "quantum tunnelling": "particles-as-waves",
    "light comes in photons": "waves-as-particles",
    "photoelectric effect": "photoelectric-effect",
    "piezoelectricity": "piezoelectricity",
    "electrons hitting metal make X-rays": "x-rays",
    "X-rays pass through tissue unevenly": "x-rays",
    "atomic resonance": "magnetic-resonance",
    "energy levels": "quantized-atom",
    "excited atoms copy the light passing through": "stimulated-emission",
    "gravity slows clocks": "gravitational-red-shift",
    "motion slows clocks": "special-relativity",
    "refraction": "refraction",
    "dispersion": "light-spectrum",
    "a curved mirror focuses light": "optics",
    # chemistry
    "burns with oxygen from the air": "combustion-and-phlogiston-theory-refinement",
    "burns all at once, without air": "oxygen",
    "catalysis": "catalysis",
    "light darkens silver salts": "photography",
    # maths a job carries out
    "trilateration": "geometry",
    "place value": "decimal-notation",
    "binary numbers": "binary-system",
    "Boolean logic": "symbolic-logic",
    "reconstruction from projections": "fourier-analysis",
    # biology
    "the body needs trace nutrients": "vitamin-concept",
    "the heart pumps blood around the body": "blood-circulation",
    "nerve signals are electrical": "electric-nerve-fibers",
    "cells live outside the body": "cell-theory",
    "the body rejects foreign tissue": "tissue-transplantation",
    "photosynthesis": "photosynthesis",
    "heredity": "genetics",
}

# Drafted links (card on an invention) -> effect. None drops the link.
CARD_FX = {
    "gravitational-red-shift": "gravity slows clocks", "special-relativity": "motion slows clocks",
    "general-relativity": None, "geometry": "trilateration", "speed-of-light": "signal delay gives distance",
    "vitamin-concept": "the body needs trace nutrients", "dietary-deficiency-diseases": None,
    "rickets": None, "scurvy": None, "pellagra": None,
    "binary-system": "binary numbers", "symbolic-logic": "Boolean logic", "laws-motion": None,
    "radio-waves": "radio waves", "maxwells-equations": None,
    "kennelly-heaviside-layer": "the ionosphere reflects radio", "latent-heat": "latent heat",
    "boyles-law": "compressed gas pushes back", "charles-law": "heating a gas expands it",
    "gas-laws": "compressing a gas heats it", "high-pressure": None, "steam-engine-efficiency": None,
    "combustion-and-phlogiston-theory-refinement": "burns with oxygen from the air",
    "aerodynamics": "lift", "trade-winds": None, "fermi-dirac-statistics": None,
    "current-and-crystals": "one-way conduction in crystals", "magnetic-resonance": "atomic resonance",
    "molecular-beams": None, "conservation-momentum": "reaction thrust", "space-flight": None,
    "alternating-current-theory": None, "black-bodies": "hot things glow",
    "cathode-rays": "electron beams", "charged-cathode-rays": "electron beams",
    "decomposition-of-water": None, "electrical-conductance": "conduction",
    "electricity-in-a-vacuum": "gas glows when current passes",
    "laws-of-electrolysis": "a reaction drives a current", "magnetic-moments": "atoms are tiny magnets",
    "ohms-law": "resistance", "particles-as-waves": "quantum tunnelling", "photoelectric-effect": "photoelectric effect",
    "piezoelectricity": "piezoelectricity", "platinum-as-catalyst": "catalysis",
    "positive-negative-charge": "static charge", "spectral-lines": "each gas glows its own colours",
    "waves-as-particles": "light comes in photons", "x-rays": "electrons hitting metal make X-rays",
    "edison-effect": "thermionic emission", "electron-emission": "thermionic emission",
    "universal-gravitation": "orbit", "lever-math": "mechanical advantage",
    "electromagnetism": "a current makes a magnet", "electrical-motion": "a magnet pushes a current",
    "acoustics": None, "hydrostatics": "buoyancy", "air-pressure": "atmospheric pressure",
    "fourier-analysis": None,
    "GAP:Elasticity (Hooke's law)": "elasticity", "GAP:Rolling friction": "rolling friction",
}
OVERRIDE = {
    ("electric-generators", "electromagnetism"): "induction",
    ("electric-generators", "electrical-motion"): None,
    ("transformer", "electromagnetism"): "induction",
    ("alternating-currents", "electromagnetism"): "induction",
    ("loudspeaker", "electromagnetism"): "a magnet pushes a current",
    ("self-starter", "electromagnetism"): "a magnet pushes a current",
    ("electric-motors", "electromagnetism"): "a magnet pushes a current",
    ("microphone", "acoustics"): "pressure changes carbon's resistance",
    ("microphone", "ohms-law"): "pressure changes carbon's resistance",
    ("sonar", "acoustics"): "sound echoes",
    ("electric-light", "ohms-law"): None,
    ("valve", "air-pressure"): None,
    ("piston-and-cylinder", "air-pressure"): None,
    ("rubber-tire", "air-pressure"): "compressed gas pushes back",
    ("parachute", "aerodynamics"): "drag",
    ("parachute", "air-pressure"): None,
    ("geissler-tubes", "air-pressure"): None,
    ("dirigible", "aerodynamics"): None,
    ("boiler", "boyles-law"): None,
    ("boiler", "combustion-and-phlogiston-theory-refinement"): None,
    ("diesel-engine", "boyles-law"): None,
    ("four-stroke-engine", "boyles-law"): None,
    ("four-stroke-engine", "gas-laws"): None,
    ("internal-combustion-engine", "gas-laws"): None,
    ("steam-turbine", "gas-laws"): None,
    ("internal-combustion-engine", "combustion-and-phlogiston-theory-refinement"): None,
    ("four-stroke-engine", "combustion-and-phlogiston-theory-refinement"): None,
    ("neon-lights", "cathode-rays"): None,
    ("daniell-cell", "electrical-conductance"): None,
    ("v-two", "universal-gravitation"): None,
    ("superheterodyne-receiver", "fourier-analysis"): None,
    ("bicycle", "conservation-momentum"): None,
    ("helicopter", "conservation-momentum"): None,
}
# Drafted inventions whose links the calibration rows below replace.
# Links this round adds to drafted inventions outside the calibration (the effect has a user the
# old draft missed).
EXTRA = [
    ("wheel-and-axle", "rolling friction"),
    ("raft", "buoyancy"), ("river-boat", "buoyancy"), ("submarine", "buoyancy"),
    ("fountain-pen", "capillary action"), ("candle", "capillary action"), ("oil-lamp", "capillary action"),
    # round 3, from Boris's comments on the drop-off list
    ("submarine", "water pressure grows with depth"), ("bathysphere", "water pressure grows with depth"),
    *[(i, "light darkens silver salts") for i in ["photographic-negative", "dry-plates", "home-photography", "motion-pictures"]],
    ("masers", "excited atoms copy the light passing through"), ("laser", "excited atoms copy the light passing through"),
]

# Why each card with no effect is left off.
LEFT_WHY = {
    "hydrostatics": "Its own effect (pressure grows with depth) isn't used yet; its drafted links were buoyancy, which now has its own card.",
    "laws-motion": "No named effect yet: reaction thrust is on Conservation of momentum.",
    "plant-nourishment": "Same effect as Photosynthesis, earlier and vaguer.",
    "decomposition-of-water": "Same effect as Laws of electrolysis: one card per effect.",
    "alternating-current-theory": "Theory: the maths of AC circuits.",
    "steam-engine-efficiency": "Theory: Carnot's limit on what a heat engine can do. Boris: no, not on the engines.",
    "photography": "Photolithography (microchips) works by it, but that's how chips are made: production, off for objects.",
}

# The 31 calibration inventions, revised after triage: (invention, [(effect or "✗ Card", note)], changed)
# A "✗ card-id" entry is a card proposed off, with why. Changed answers Boris's tick or comment.
CALIB = [
    ("gps", [("gravity slows clocks", ""), ("motion slows clocks", ""), ("signal delay gives distance", ""),
             ("trilateration", "the receiver finds its position from distances to several satellites"),
             ("✗ general-relativity", "theory: the effect is on Gravitational red shift"),
             ("✗ radio-waves", "through its part, the satellites")],
     "Added Geometry as trilateration, per your comment: maths counts when the job carries it out (Fourier on CAT scan, Positional notation on the calculator, Binary and logic on microchips)."),
    ("vitamin-pills", [("the body needs trace nutrients", ""),
                       ("✗ dietary-deficiency-diseases", "same effect as Vitamin concept: one card per effect"),
                       ("✗ rickets", "disease"), ("✗ scurvy", "disease"), ("✗ pellagra", "disease")],
     "No change."),
    ("microchips", [("binary numbers", "now in, under the maths rule"), ("Boolean logic", "now in, under the maths rule"),
                    ("✗ photography", "tiny fabrication is photolithography: light changes a resist, which the Photography card describes. But it's how chips are made")],
     "Binary and Boolean logic now in (maths the job carries out). On tiny fabrication: photolithography is real, but it's production. I'd keep production off for objects and count it for materials only (see Pyroxylin). OK?"),
    ("stagecoach", [("✗ laws-motion", "no effect I can name for it beyond 'things move when pushed'")],
     "Pushing back a little: with an effect on every link, Laws of motion needs a named effect, and for a stagecoach I can't name one. I'd rather show none (you ticked Metal stirrups with none). Laws of motion stays for named effects (none so far)."),
    ("radio", [("the ionosphere reflects radio", ""),
               ("✗ radio-waves", "now comes through its part, Radio antennas: own-level rule"),
               ("✗ maxwells-equations", "theory")],
     "Radio waves moved to Radio antennas (the part that radiates them)."),
    ("boiler", [("latent heat", "water takes in a lot of heat to become steam"),
                ("✗ boyles-law", "a boiler's pressure comes from boiling, not from squeezing a gas"),
                ("✗ combustion-and-phlogiston-theory-refinement", "on the fuel")],
     "Boyle's law: no longer folded into Gas laws. With effects on links it's its own card, for compressed gas pushing back (rubber tire, Jarvik heart). It's still off the boiler, whose pressure comes from boiling water."),
    ("diesel-engine", [("compressing a gas heats it", "ignites the fuel with no spark"),
                       ("✗ boyles-law", "the effect is heating by compression: Gas laws"),
                       ("✗ steam-engine-efficiency", "theory: Diesel designed from it, but the engine doesn't work by it"), ("✗ high-pressure", "technique")],
     "Steam engine efficiency stays off, per your answer in chat."),
    ("sail", [("lift", ""), ("✗ trade-winds", "where, not how")], "No change."),
    ("transistor", [("one-way conduction in crystals", ""), ("✗ fermi-dirac-statistics", "theory")], "No change."),
    ("atomic-clock", [("atomic resonance", ""), ("✗ molecular-beams", "technique")], "No change."),
    ("liquid-fuel-rockets", [("reaction thrust", ""),
                             ("✗ laws-motion", "same effect: one card per effect"), ("✗ space-flight", "idea")],
     "No change."),
    ("continuous-maser", [("excited atoms copy the light passing through", "new card: Masers, Continuous maser, Laser"), ("energy levels", "a theory card standing in")], "No change."),
    ("adding-machine", [("place value", "each wheel carries into the next"),
                        ("✗ lever-math", "through its gear train")],
     "Added Positional notation as place value, per your comment."),
    ("cat-scan", [("X-rays pass through tissue unevenly", ""),
                  ("reconstruction from projections", "per your comment")],
     "Added Fourier analysis. X-rays is also on the Coolidge tube, but as a different effect (making X-rays), so it isn't a repeat."),
    ("jarvik-hearts", [("compressed gas pushes back", "driven by pulses of compressed air"),
                       ("the heart pumps blood around the body", "per your comment")],
     "Added Blood circulation: the body process a medical device works with counts (heart transplants too). Air pressure moved to Boyle's law, since the drive is compressed air, not a vacuum."),
    ("schmidt-camera", [("refraction", "the corrector plate"),
                        ("a curved mirror focuses light", "per your comment"),
                        ("✗ stellar-photography", "a use, not a phenomenon")],
     "Optics added for the mirror. Stellar photography stays off."),
    ("achromatic-lens", [("refraction", ""), ("dispersion", "")], "No change."),
    ("metal-stirrup", [], "No change: none."),
    ("ballpoint-pen", [("capillary action", "new card"), ("✗ universal-gravitation", "too general")], "No change."),
    ("paved-road", [("rolling friction", "a hard, smooth surface lets wheels roll with little loss")],
     "Unticked, so I looked again: rolling friction. With Ball bearing and Wheel and axle that's 3 uses, so Rolling friction earns a card."),
    ("bow", [("elasticity", "new card"), ("✗ laws-motion", "no named effect")], "No change."),
    ("bessemer-steel", [("✗ combustion-and-phlogiston-theory-refinement", "the blast burning carbon out is how it's made: production")],
     "Your answer in chat: the reaction that makes a material doesn't count. Combustion comes off; none."),
    ("pyroxylin", [("burns all at once, without air", "")],
     "Your answer in chat: the reaction that makes a material doesn't count, so nitration is off. Nov 14 (Q4): it burns all at once without air, like Nitroglycerine, so it gets that."),
    ("vitamin-b-12-synthesis", [("the body needs trace nutrients", ""), ("✗ pernicious-anemia", "disease"),
                                ("✗ cyanocobalamin-structure", "knowledge")], "No change."),
    ("coal-mining", [("✗ combustion-and-phlogiston-theory-refinement", "moved to the fuels made from coal"), ("✗ photosynthesis", "how coal formed")],
     "Nov 14, per chat (Q5): combustion moved to the fuel that's burned: Kerosene, Coal hydrogenation."),
    ("oil-wells", [("✗ combustion-and-phlogiston-theory-refinement", "moved to Gasoline"), ("✗ hydrostatics", "extraction")],
     "Nov 14, per chat (Q5): combustion moved to the fuel that's burned: Gasoline."),
    ("anesthesia", [("✗ hypnotism", "not how it works")], "No change."),
    ("electroencephalography", [("nerve signals are electrical", ""), ("✗ nerve-fibers", "anatomy"),
                                ("✗ electrical-stimulation", "same effect, less specific")], "No change."),
    ("tissue-culture", [("cells live outside the body", "")], "No change."),
    ("heart-transplants", [("the body rejects foreign tissue", ""), ("the heart pumps blood around the body", "same rule as Jarvik hearts")],
     "Added Blood circulation, as on Jarvik hearts."),
    ("agriculture", [("✗ photosynthesis", "what plants do anyway, not what domestication uses"),
                     ("✗ genetics", "per your answer in chat"),
                     ("✗ plant-nourishment", "same effect as Photosynthesis, earlier and vaguer")],
     "Your answer in chat: none."),
]


def drafted_phen():
    """The pilot and batch 1 phenomenon lists, as drafted (card ids, or ('gap', name))."""
    import pilot_data, batches
    phen = {cid: ph for cid, (j, sl, ph) in pilot_data.CARDS.items()}
    phen.update({cid: ph for _, b in batches.BATCHES for cid, (j, ex, ph) in b.items()})
    phen.update({cid: ph for cid, (j, sl, ph) in batches.SUPPORT.items()})
    return phen


def build():
    from lists import CARDS, NEW_CARDS
    PHEN = drafted_phen()
    rows = {r['ID']: r for r in csv.DictReader(open(os.path.join(HERE, '..', '..', 'static', 'asimov.tsv')), delimiter='\t')}
    title = lambda i: i[len('no card: '):] if i.startswith('no card: ') else NEW_CARDS[i][0] if i in NEW_CARDS else rows[i]['Title']
    for fx, card in EFFECTS.items():
        assert card.startswith('no card: ') or card in rows or card in NEW_CARDS, card

    # Effects per invention: drafted links mapped, then calibration rows replace theirs.
    own = collections.defaultdict(set)
    dropped = collections.defaultdict(list)  # card -> [(inv, effect or None)] for the broad-card section
    for inv, ph in PHEN.items():
        for p in ph:
            key = p if isinstance(p, str) else 'GAP:' + p[1]
            fx = OVERRIDE.get((inv, key), CARD_FX[key]) if (inv, key) in OVERRIDE else CARD_FX[key]
            dropped[key].append((inv, fx))
            if fx: own[inv].add(fx)
    for inv, fx in EXTRA:
        own[inv].add(fx)
    for inv, items, _ in CALIB:
        own[inv] = {fx for fx, _ in items if not fx.startswith('✗')}
        for fx in own[inv]:
            assert fx in EFFECTS, fx

    # Own level: drop an effect that one of the invention's parts (at any depth) already has.
    parts = {cid: [s[2] for s in c[1] if s[2]] for cid, c in CARDS.items()}
    memo = {}
    def reach(cid, seen=()):
        if cid in memo: return memo[cid]
        r = set(own.get(cid, ()))
        for p in parts.get(cid, []):
            if p not in seen: r |= reach(p, seen + (cid,))
        memo[cid] = r
        return r
    final = {}
    through = {}
    for inv, fxs in own.items():
        below = set().union(*[reach(p) for p in parts.get(inv, [])]) if parts.get(inv) else set()
        final[inv] = fxs - below
        through[inv] = fxs & below

    users = collections.defaultdict(list)
    for inv, fxs in final.items():
        for fx in fxs: users[fx].append(inv)
    yr = lambda i: int(rows[i]['Year'].replace(' BCE', '').replace('BCE', '')) * (-1 if 'BCE' in rows[i]['Year'] else 1) if i in rows else int(NEW_CARDS[i][1])
    names = lambda ids: ', '.join(title(i) for i in sorted(ids, key=yr))

    # ---- calibration "Changed" column, rows 2..32 in the sheet's order
    changed = []
    for inv, items, note in CALIB:
        lines = []
        for fx, why in items:
            if fx.startswith('✗'):
                lines.append(f"✗ {title(fx[2:])}: {why}")
            else:
                card = EFFECTS[fx]
                c = title(card) + (' (no card)' if card.startswith('no card: ') else '')
                lines.append(f"+ {fx} → {c}" + (f": {why}" if why else ''))
        changed.append((inv, note + ("\n" + "\n".join(lines) if lines else "")))

    # ---- Effects tab
    out = [["Looks right", "Effect", "Card", "Proposal", "Used by", "Why", "Your comment", "Changed"]]
    headers = []
    def section(label):
        headers.append(len(out) + 1)
        out.append([None, label] + [None] * 6)
    by_card = collections.defaultdict(list)
    for fx, card in EFFECTS.items(): by_card[card].append(fx)
    deck = [(fx, c) for fx, c in EFFECTS.items() if not c.startswith('no card: ')]
    gaps = [(fx, c) for fx, c in EFFECTS.items() if c.startswith('no card: ')]
    section("EFFECTS WITH A DECK CARD: the card's own text describes the effect")
    for fx, card in sorted(deck, key=lambda x: yr(x[1])):
        u = users.get(fx, [])
        share = [f for f in by_card[card] if f != fx]
        why = f"Same card as {', '.join(share)}." if share else ""
        out.append([False, fx, title(card) + " (" + rows[card]['Year'] + ")", "link", f"{len(u)}: {names(u)}" if u else "0", why, None, None])
    section("EFFECTS WITH NO CARD: a new card at 3 or more uses, otherwise a gap")
    for fx, card in gaps:
        u = users.get(fx, [])
        prop = "new card" if len(u) >= 3 else "gap"
        out.append([False, fx, title(card), prop, f"{len(u)}: {names(u)}" if u else "0", "", None, None])
    section("WHERE THE BROAD CARDS' DRAFTED LINKS WENT")
    for card in ["laws-motion", "electromagnetism", "aerodynamics", "air-pressure", "conservation-momentum", "acoustics", "hydrostatics", "boyles-law"]:
        moved = collections.defaultdict(list)
        for inv, fx in dropped[card]:
            if fx is None: moved['dropped: no effect of its own on this card'].append(inv)
            elif fx in through.get(inv, ()): moved[f'dropped: {fx} comes through a part'].append(inv)
            else: moved[f'{fx} → {title(EFFECTS[fx])}'].append(inv)
        txt = "\n".join(f"{k}: {names(v)}" for k, v in moved.items())
        out.append([False, title(card) + f" ({len(dropped[card])} drafted links)", None, "split by effect", txt, None, None, None])
    left = sorted({k for k, v in CARD_FX.items() if v is None} | {fx[2:] for _, items, _ in CALIB for fx, _ in items if fx.startswith('✗')})
    left = [c for c in left if c not in EFFECTS.values()]
    section("CARDS THAT DROP OFF: no invention uses an effect they describe")
    reasons = {}
    for _, items, _ in CALIB:
        for fx, why in items:
            if fx.startswith('✗'): reasons.setdefault(fx[2:], why)
    for c in sorted(left, key=yr):
        out.append([False, title(c), rows[c]['Year'] if c in rows else '', "leave off", None, LEFT_WHY.get(c, reasons.get(c, '')), None, None])
    return changed, out, headers


def final_links():
    """Every invention's phenomena after all batches (pilot and batch 1 mapped onto effects,
    calibration, and the drafts in phenomena_drafts.py), with the own-level rule applied.
    Returns (effects: effect -> card id or 'no card: Name',
             final: inv -> {effect: note}, through: inv -> {effect} its parts already carry)."""
    import phenomena_drafts as D
    from lists import CARDS
    PHEN = drafted_phen()
    fxmap = dict(EFFECTS)
    fxmap.update(D.NEW_EFFECTS)
    own = collections.defaultdict(dict)
    for inv, ph in PHEN.items():
        for p in ph:
            key = p if isinstance(p, str) else 'GAP:' + p[1]
            fx = OVERRIDE.get((inv, key), CARD_FX[key]) if (inv, key) in OVERRIDE else CARD_FX[key]
            if fx: own[inv][fx] = ''
    for inv in PHEN:
        own.setdefault(inv, {})  # drafted links that all mapped to None: none
    for inv, fx in EXTRA:
        own[inv][fx] = ''
    for inv, items, _ in CALIB:
        own[inv] = {fx: n for fx, n in items if not fx.startswith('✗')}
    for src in (D.MATERIALS, D.PRACTICES, D.LEFTOVERS, D.OBJECTS):
        for inv, items in src.items():
            own[inv] = dict(items)
    for groups in (D.NONE_GROUPS, D.PRACTICE_NONE_GROUPS):
        for g in groups:
            for inv in g[2]: own[inv] = {}
    for inv in D.LEFTOVER_NONE: own[inv] = {}
    for _, ids in D.OBJECT_NONE:
        for inv in ids: own[inv] = {}
    for inv, fxs in own.items():
        for fx in fxs: assert fx in fxmap, (inv, fx)
    parts = {cid: [s[2] for s in c[1] if s[2]] for cid, c in CARDS.items()}
    memo = {}
    def reach(cid, seen=()):
        if cid in memo: return memo[cid]
        r = set(own.get(cid, ()))
        for p in parts.get(cid, []):
            if p not in seen: r |= reach(p, seen + (cid,))
        memo[cid] = r
        return r
    final, through = {}, {}
    for inv, fxs in own.items():
        below = set().union(*[reach(p) for p in parts.get(inv, [])]) if parts.get(inv) else set()
        final[inv] = {fx: n for fx, n in fxs.items() if fx not in below}
        through[inv] = set(fxs) & below
    return fxmap, final, through


def export():
    """Write every card's phenomena into assemblies.json as "phenomena": card -> [{effect, card | gap}].
    Own level applied; a card that isn't listed has none. Replaces the key if it's there."""
    fx, final, _ = final_links()
    path = os.path.join(HERE, 'assemblies.json')
    s = open(path).read()
    if '\n "phenomena": {' in s:
        i = s.index(',\n "phenomena": {')
        j = s.index('\n }', i) + 3
        s = s[:i] + s[j:]
    lines = []
    for inv in sorted(k for k, v in final.items() if v):
        items = []
        for e in sorted(final[inv]):
            c = fx[e]
            ref = {'gap': c[len('no card: '):]} if c.startswith('no card: ') else {'card': c}
            items.append('   ' + json.dumps({'effect': e, **ref}, ensure_ascii=False))
        lines.append(f'  {json.dumps(inv)}: [\n' + ',\n'.join(items) + '\n  ]')
    block = ',\n "phenomena": {\n' + ',\n'.join(lines) + '\n }'
    assert s.endswith('\n }\n}\n') or s.endswith('\n }\n}'), s[-20:]
    k = s.rstrip().rindex('\n}')
    s = s[:k] + block + s[k:]
    json.loads(s)
    open(path, 'w').write(s)
    return sum(len(v) for v in final.values()), sum(1 for v in final.values() if v)


if __name__ == '__main__':
    if sys.argv[1:] == ['export']:
        print('exported %d links on %d cards' % export())
        sys.exit()
    changed, out, headers = build()
    o = os.environ.get('OUT', '.')
    json.dump({"changed": changed, "effects": out, "headers": headers}, open(os.path.join(o, 'effects.json'), 'w'), ensure_ascii=False, indent=1)
    print(len(out) - 1, 'effect rows; headers at', headers)
    for r in out: print(' | '.join('' if x is None else str(x) for x in r[1:6])[:230])
