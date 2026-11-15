# Phenomenon drafts for the inventions not in the pilot, batch 1, or the calibration,
# under rules 21-28 (RULES.md). Each batch: invention -> [(effect, note)]; [] means none.
# New effects extend phenomena_effects.EFFECTS. Stretch rows are the ones where a rule had
# to be stretched; they go last on the sheet with a question.

NEW_EFFECTS = {
    "the body learns to fight a germ": "vaccination",
    "antibodies in serum neutralize a toxin": "vaccination",
    "a chemical kills the germ but not the patient": "chemotherapy",
    "hormones regulate the body": "hormones",
    "plants need nitrogen from the soil": "nitrogen-fixation",
    "gas dissolves in water under pressure": "soluble-gases",
    "sets hard by reacting with water": "no card: Hydration",
    "slows the burning in the cylinder": "no card: Knock suppression",
    # stretch
    "a plant hormone drives growth": "gibberellins",
    "a drug fits the nerves' pain receptors": "endorphins",
    "chemicals carry signals between nerves": "vagusstoffe",
}

# Groups of "none" rows, so they can be ticked together: (heading, why, [ids]).
NONE_GROUPS = [
    ("Metals and alloys", "Their job is forming a body; no effect of their own to name (rule 28). How they're smelted or alloyed is production (rule 4).",
     ["copper", "bronze", "steel", "alloy-steel", "coke-iron", "malleable-platinum", "aluminum-process", "zinc", "lead", "mercury"]),
    ("Glass, ceramics, plastics, rubber", "Form a body. Being clear, hard-wearing or stretchy is a property, not an effect a card describes (but see the stretch rows on properties).",
     ["glass", "plate-glass", "porcelain", "celluloid", "isotactic-polymers", "teflon", "vulcanization-of-rubber", "neoprene", "reinforced-concrete"]),
    ("Fibres, writing surfaces, leather", "Form a body or take the print; nothing to name.",
     ["fish-nets", "rayon", "nylon", "papyrus", "parchment", "paper", "leather"]),
    ("Ingredients", "Their job is going into something else; what they do happens in what they make.",
     ["sulfur", "sulfuric-acid", "synthetic-urea"]),
    ("Colour, taste, filling", "No deck card describes how dyes bind, how sweetness is tasted, or amalgam setting; none of them is a key effect worth a gap.",
     ["dye", "synthetic-dyes", "ink", "saccharin", "silver-fillings"]),
    ("Explosives made from other explosives", "Burning without air comes through their parts (rule 23): Nitroglycerine, Pyroxylin.",
     ["dynamite", "cordite"]),
]

MATERIALS = {
    # plain: the rules decide these
    "vitamin-e-synthesis": [("the body needs trace nutrients", "")],
    "synthetic-vitamin-c": [("the body needs trace nutrients", "")],
    "steroid-synthesis": [("hormones regulate the body", "cortisone and cholesterol's relatives are hormones")],
    "oxytocin-synthesis": [("hormones regulate the body", "")],
    "oral-contraceptives": [("hormones regulate the body", "the pill's hormones stop ovulation")],
    "freon": [("latent heat", "evaporating takes in heat: that's how it carries heat out of the fridge")],
    "carbonated-water": [("gas dissolves in water under pressure", "the card is Priestley dissolving gases in water")],
    "greek-fire": [("burns with oxygen from the air", "")],
    "gunpowder": [("burns all at once, without air", "its saltpeter supplies the oxygen")],
    "portland-cement": [("sets hard by reacting with water", "its key effect, so the gap stays (rule 16)")],
    "tetraethyl-lead": [("slows the burning in the cylinder", "its key effect, so the gap stays (rule 16)")],
    # Vaccination: off the board, now a phenomenon card (rule 9; it had no parts and was no one's part)
    "yellow-fever-vaccine": [("the body learns to fight a germ", "")],
    "salk-vaccine": [("the body learns to fight a germ", "a killed virus")],
    "sabin-vaccine": [("the body learns to fight a germ", "a live, weakened virus")],
    "antitoxin": [("antibodies in serum neutralize a toxin", "borrowed immunity from a horse's blood")],
    # Chemotherapy: same
    "penicillin-practical": [("a chemical kills the germ but not the patient", "")],
    "prontosil": [("a chemical kills the germ but not the patient", "")],
    "syphilis-treatment": [("a chemical kills the germ but not the patient", "Ehrlich's arsphenamine, the first 'magic bullet'")],
    "quinacrine": [("a chemical kills the germ but not the patient", "kills the malaria parasite")],
    "synthesis-of-quinine": [("a chemical kills the germ but not the patient", "kills the malaria parasite")],
    # Q1, Nov 14: plants needing nitrogen is important to cover (rule 26)
    "chemical-fertilizer": [("plants need nitrogen from the soil", "")],
    "haber-process": [("plants need nitrogen from the soil", "as fertilizer; the catalyst and high pressure are how it's made (rule 4)")],
    # 2,4-D, Nov 14: Gibberellins' text describes the effect, though it's another hormone family
    "2,4-d": [("a plant hormone drives growth", "a fake plant hormone: broad-leaved weeds grow themselves to death; explained later (1957)")],
    # Q2, Nov 14: a property isn't a specific enough phenomenon (rule 28). No Hardness card.
    "bakelite": [],
    "carborundum": [],
    "synthetic-diamonds": [],
    "borazon": [],
    # Q3, Nov 14: deck cards for each drug's effect, all explained later
    "morphine-synthesis": [("a drug fits the nerves' pain receptors", "the receptors endorphins act on; explained later (1975)")],
    "barbiturates": [("chemicals carry signals between nerves", "sleeping pills act at the synapse; explained later (1921)")],
    "novocaine": [("nerve signals are electrical", "it blocks the signal; explained later (1922)")],
    # Q4, Nov 14: explosives burn without air (Pyroxylin too, in phenomena_effects.CALIB)
    "nitroglycerine": [("burns all at once, without air", "")],
    # Q5, Nov 14: combustion on the fuel that's burned, moved off Oil wells and Coal mining
    "gasoline": [("burns with oxygen from the air", "")],
    "kerosene": [("burns with oxygen from the air", "")],
    "coal-hydrogenation": [("burns with oxygen from the air", "")],
}

STRETCH = {
}

# ---------- Practices (58: the 56 with lists, plus Animals domesticated and Radioactive lead tracing,
# which only appear as parts). Nov 14. Parts that are objects aren't drafted yet; rule 23 assumes they
# carry their own effects (Photocell: photoelectric effect, Heart-lung machine: circulation).
PRACTICE_EFFECTS = {
    "rubbing makes heat": "mechanical-equivalent-of-heat",
    "yeast turns sugar into alcohol": "ferments-and-enzymes",
    "alcohol boils before water": "no card: Boiling points",
    "heat kills microbes": "no-spontaneous-generation-redux",
    "a chemical kills germs on contact": "no card: Antisepsis",
    "dyes stain some parts of a cell and not others": "chromatin",
    "the eye blends quick still pictures into motion": "no card: Persistence of vision",
    "muscles work by electrical impulses": "electrical-stimulation",
    "ultraviolet light makes vitamin D": "ultraviolet",
    "viruses multiply only inside living cells": "virus-transduction",
    "charged particles move through a solution": "ionic-dissociation",
    "light lets a coating conduct": "photovoltaic-cells",
    "droplets form around a seed": "cloud-chamber",
    "light waves interfere": "light-waves",
    "fluoride protects teeth from decay": "no card: Fluoride and teeth",
    "an antibody binds only its own target": "no card: Antibody specificity",
    "radioactive atoms give off radiation": "uranium-radiations",
    "impurities stay in the melted part": "no card: Impurity segregation",
    "an egg can be fertilized outside the body": "fertilization-observed",
    "a cell follows genes put into it": "virus-transduction",
    "a body cell's nucleus can grow a whole animal": "no card: Nuclear transfer",
    "an enzyme cuts DNA at set places": "no card: Restriction enzymes",
    "plants need water": "no card: Plants need water",
    "parts of a mixture travel at different speeds": "chromatography",  # Nov 14: Chromatography a phenomenon card
    "blood flows in closed vessels": "blood-circulation",  # Rational surgery, approved Nov 14
}
NEW_EFFECTS.update(PRACTICE_EFFECTS)

GAP = "its key effect, so the gap stays (rule 16)"
PRACTICES = {
    "fire": [("burns with oxygen from the air", "explained later"), ("rubbing makes heat", "its text: started by spinning sticks; explained later")],
    "irrigation": [("plants need water", GAP + "; a need it supplies (rule 26)")],
    "fermentation": [("yeast turns sugar into alcohol", "Yeast is its part with no card; this card is the effect; explained later")],
    "distillation": [("alcohol boils before water", GAP)],
    "smallpox-vaccine": [("the body learns to fight a germ", "explained later")],
    "canning-food": [("heat kills microbes", "Spallanzani's boiled, sealed broth stayed clear: canning exactly")],
    "pasteurization": [("heat kills microbes", "")],
    "antiseptic-surgery": [("a chemical kills germs on contact", GAP + ". Germ theory is why it helps: needed to know (rule 5)")],
    "anthrax-inoculation": [("the body learns to fight a germ", "a weakened germ")],
    "rabies": [("the body learns to fight a germ", "a weakened germ")],
    "bacterial-staining": [("dyes stain some parts of a cell and not others", "")],
    "home-photography": [("light darkens silver salts", "already linked on the Effects tab")],
    "motion-pictures": [("light darkens silver salts", "already linked on the Effects tab"),
                        ("the eye blends quick still pictures into motion", GAP + "; television may make it 3 uses")],
    "electrocardiogram": [("muscles work by electrical impulses", "the heart muscle's own; Galvani's twitching frog legs")],
    "irradiation": [("ultraviolet light makes vitamin D", "the only ultraviolet card, standing in (rule 9); Rickets is the disease (rule 25)")],
    "virus-culture": [("viruses multiply only inside living cells", "so they're grown in eggs; explained later")],
    "virus-culture-penicillin": [("viruses multiply only inside living cells", "explained later")],
    "electrophoresis": [("charged particles move through a solution", "proteins carry charge, like ions")],
    "xerography": [("static charge", "the charged plate pulls the powder"), ("light lets a coating conduct", "light clears the charge where it falls; explained later")],
    "photocopying": [("static charge", ""), ("light lets a coating conduct", "its part Selenium may carry this once the leftover materials are drafted (rule 23)")],
    "frequency-modulation": [("radio waves", "no parts to carry it")],
    "cloud-seeding": [("droplets form around a seed", "a card on the board; its text: 'droplets form around ions'")],
    "holography": [("light waves interfere", "")],
    "fluoridation": [("fluoride protects teeth from decay", GAP)],
    "radioactive-tracers": [("radioactive atoms give off radiation", "")],
    "radioimmune-assay": [("an antibody binds only its own target", GAP + "; radiation comes through its part")],
    "zone-refining": [("impurities stay in the melted part", GAP)],
    "kidney-transplant": [("the body rejects foreign tissue", "between identical twins, so no rejection")],
    "test-tube-baby": [("an egg can be fertilized outside the body", "the card is a sea urchin egg, fertilized in water")],
    "recombinant-dna": [("an enzyme cuts DNA at set places", GAP)],
    "genetic-engineering": [("a cell follows genes put into it", "")],
    "synthetic-gene": [("a cell follows genes put into it", "")],
    "genetic-medicine": [("a cell follows genes put into it", "a disarmed virus carries the gene in")],
    "vertebrate-clones": [("a body cell's nucleus can grow a whole animal", GAP)],
    # Nov 14, per sheet: Chromatography became a phenomenon card (excluded in assemblies.json)
    "paper-chromatography": [("parts of a mixture travel at different speeds", "")],
    "starch-chromatography": [("parts of a mixture travel at different speeds", "")],
    "gas-chromatography": [("parts of a mixture travel at different speeds", "")],
    # Nov 14, per Boris's comment ("could tie to anatomy") and tick on my proposal
    "surgery": [("blood flows in closed vessels", "tying off an artery stops the bleeding; explained later")],
}

PRACTICE_NONE_GROUPS = [
    ("What living things do anyway (rule 26)", "Animals breeding, bacteria growing on a dish: what they do anyway.",
     ["animal-dom", "bacterial-cultivation"]),
    ("Craft and manufacturing", "Skill and organization, no effect a card describes (rule 28). Glass blowing uses hot glass being soft: a property.",
     ["glass-blowing", "block-printing", "interchangeable-parts", "assembly-line", "dentistry"]),
    ("Syntheses", "Building a molecule from scratch; chemistry in general, nothing specific to name (rule 28).",
     ["synthetic-peptides", "strychnine-synthesis", "chlorophyll-synthesis", "protein-synthesis", "gene-synthesis"]),
    ("Effects come through their parts (rule 23)", "Talking pictures (Photocell, Triode, Loudspeaker), Fiber optic communication (Fiber optics, Laser, Photocell), bypass and angioplasty (Heart-lung machine, Cardiac catheter), catheterization (X-rays through the Coolidge tube; the route through the veins is anatomy), Painless childbirth (Chloroform; Anesthesia got none in calibration).",
     ["talking-pictures", "fiber-optic-communication", "coronary-bypass-surgery", "balloon-angioplasty", "cardiac-catheterization-practice", "painless-childbirth"]),
    ("Its own effect's card", "Photography is the card for 'light darkens silver salts'; a card never links to itself (rule 9).",
     ["photography"]),
]

PRACTICE_QUESTIONS = {}  # both answered Nov 14: Rational surgery linked, Talking pictures none (persistence of vision via Motion pictures)


# ---- Leftovers (Nov 14): board cards that are only ever parts, so no batch covered them.
# Principle proposed with them (an addition to rule 24): an element or plain substance gets an effect
# only when it does it on its own, the same way in every use; when its jobs differ, or it's one
# ingredient of a compound or alloy, it gets none and the effect stays on the invention.
LEFTOVER_EFFECTS = {
    "alpha rays knock neutrons out of beryllium": "neutron",
    "a neutron splits a heavy atom, freeing more neutrons": "nuclear-chain-reaction",
    "light atoms fuse, releasing energy": "solar-energy-source",
}
NEW_EFFECTS.update(LEFTOVER_EFFECTS)
NUTRIENT = ("the body needs trace nutrients", "")
LEFTOVERS = {
    "penicillin": [("a chemical kills the germ but not the patient", "its card: the mold killed the germs but not human cells. Practical penicillin then gets it through this part (rule 23)")],
    "sex-hormones": [("hormones regulate the body", "Oral contraceptives then gets it through this part (rule 23)")],
    "beryllium": [("alpha rays knock neutrons out of beryllium", "the bomb's initiator; the Neutron card is exactly this")],
    "polonium-and-radium": [("radioactive atoms give off radiation", "the initiator's alpha source")],
    "uranium-two-three-five": [("a neutron splits a heavy atom, freeing more neutrons", "the fission bomb's core")],
    "neptunium-and-plutonium": [("a neutron splits a heavy atom, freeing more neutrons", "the fission bomb's core; in Breeder reactors it's what gets made, which doesn't count (rule 24)")],
    "deuterium": [("light atoms fuse, releasing energy", "Fusion bomb and Stellarator would get it through this part (rule 23)")],
    **{v: [NUTRIENT] for v in ["vitamins-a-and-b", "vitamin-e", "ascorbic-acid", "riboflavin", "thiamine",
                               "niacin", "vitamin-k", "biotin", "cyanocobalamin", "essential-minerals"]},
}
LEFTOVERS["vitamins-a-and-b"] = [(NUTRIENT[0], "and the same for each vitamin below: Vitamin pills then gets it through its vitamins (rule 23)")]
LEFTOVER_NONE = {
    "horse": "A living thing doing what it does (rule 26). Antitoxin's serum effect stays on Antitoxin.",
    "silk-europe": "A property: strong and light (rule 28).",
    "pendulum": "Its own card is the one for the steady swing, and a card can't link to itself (rule 9). Grandfather clocks get it through this part; the seismograph's pendulum works by inertia, which is the seismograph's.",
    "quinine": "Only used as an ingredient of Polaroid's crystals. Its malaria effect is on Synthesis of quinine.",
    "phosphorus": "Two different jobs (a match head that catches fire, a fertilizer that feeds plants): the effects stay on Matches and Chemical fertilizer.",
    "cobalt": "An ingredient of the magnet alloy; magnetism stays on Rare-earth magnet.",
    "thulium-holmium-samarium": "An ingredient of the magnet alloy; magnetism stays on Rare-earth magnet.",
    "praseodymium-and-neodymium": "An ingredient of the magnet alloy; magnetism stays on Rare-earth magnet.",
    "dysprosium": "An ingredient of the magnet alloy; magnetism stays on Rare-earth magnet.",
    "platinum": "Different jobs: the catalyst in the Fuel cell (catalysis stays there), a plain electrode in Geissler tubes.",
    "carbon-dioxide": "Dissolving under pressure needs the water and the pressure, so it stays on Carbonated water.",
    "hydrogen": "Different jobs: lift gas, fuel, reactant. Being light is a property.",
    "nitrogen": "Different jobs: a gas that doesn't react (light bulbs), a raw material (fertilizer, Haber process).",
    "oxygen": "Different jobs: fuel cell reactant, breathing gas, the heart-lung machine's oxygenator.",
    "tungsten": "A property: it melts only at very high heat.",
    "uranium": "Different jobs: reactor fuel, bomb tamper, breeder blanket (where it soaks up neutrons to make plutonium). The effects stay on each.",
    "chromium": "An ingredient of the laser's ruby rod.",
    "liquid-ammonia": "Different jobs: refrigerant (latent heat), and the molecule that resonates in the atomic clock and maser. The effects stay on each.",
    "cerium-osmium-iridium": "An ingredient of the Welsbach mantle; the glow is the mantle's.",
    "thorium": "An ingredient of the Welsbach mantle; the glow is the mantle's.",
    "sodium-and-potassium": "Different jobs: potash, reactor coolant, the photocell's cathode.",
    "chlorine": "An ingredient of Freon and Neoprene.",
    "iodine": "Different jobs: a nutrient, a plate coating, Polaroid's crystals, a cloud seed.",
    "silicon": "Different jobs; being a semiconductor is a property.",
    "aluminum": "A property: light and strong.",
    "discovery-of-bromine": "An ingredient of the emulsion (silver bromide); Dry plates keep 'light darkens silver salts'.",
    "cellulose": "Different jobs (fiber, membrane); both are properties.",
    "dry-ice": "Its cold is a property; Cloud-seeding keeps 'droplets form around a seed'.",
    "gallium": "An ingredient of the LED's crystal.",
    "liquid-oxygen": "Oxygen kept liquid by cold, a property; the burning is the rocket's.",
    "europium": "An ingredient of the TV's red phosphor.",
    "fluorine": "An ingredient of Freon and Teflon; fluoride's effect stays on Fluoridation.",
    "germanium": "Being a semiconductor is a property; one-way conduction needs the junction, so it stays on Transistor and Tunnel diode.",
    "argon": "A gas that doesn't react, a property; the counting is the Geiger counter's.",
    "helium-on-earth": "The imaging gas; the effect is the microscope's.",
    "liquid-hydrogen": "Different jobs: the bubble chamber's liquid, rocket fuel.",
    "neon-krypton-xenon": "Glowing needs the current, so 'each gas glows its own colours' stays on Neon lights; the spark chamber is a different job.",
    "cadmium-lithium-selenium": "Three elements, four different jobs (fusion fuel, copier drum, control rods, battery). So Photocopying keeps 'light lets a coating conduct'.",
}
# Nov 14, per sheet: all borderline picks accepted (rule 24 addition, ingredients carry their effect,
# General anesthesia as a gap, Uranium/Pendulum/Germanium/Platinum/Carbon dioxide/Quinine none).
NEW_EFFECTS["an inhaled drug puts the patient beyond pain"] = "no card: General anesthesia"
for _k in ["chloroform", "nitrous-oxide"]:
    LEFTOVERS[_k] = [("an inhaled drug puts the patient beyond pain", "its key effect, so the gap stays (rule 16); Anesthesia and Painless childbirth get it through this part")]
LEFTOVER_QUESTIONS = {}


# ---- Objects (Nov 14): the last batch, 201 cards. Only borderline calls go to Boris (OBJECT_BORDERLINE);
# the rest are listed on the tab as clear, for reference. Nov 14: Boris accepted all 10 picks except
# Arches, which now get Laws of motion per his comment.
OBJECT_EFFECTS = {
    "the Earth's turning moves the shadow": "rotation-of-the-earth",
    "a lever balances equal weights": "lever-math",
    "momentum carries into the strike": "conservation-momentum",
    "the Earth is a magnet": "earth-magnet",
    "adding logarithms multiplies numbers": "logarithms",
    "integration": "calculus",
    "liquids expand when heated": "thermal-expansion",
    "a spinning body holds its axis": "gyroscope",
    "pressure raises water's boiling point": "no card: Boiling points",
    "a vacuum stops heat passing": "no card: Vacuum insulation",
    "heat radiates as invisible light": "infrared-radiation",
    "a heavy mass stays put while the ground moves": "laws-motion",
    "sound is a vibration": "acoustics",
    "gas molecules push harder off the warm side": "kinetic-theory-of-gases",
    "small particles scatter light": "no card: Light scattering",
    "spinning pulls heavier particles outward": "no card: Sedimentation",
    "electrons travel as waves": "particles-as-waves",
    "some crystals pass light vibrating one way only": "polarized-light",
    "some crystals split light in two": "double-refraction",
    "small molecules seep through a membrane": "osmosis",
    "radiation ionizes what it passes through": "ionizing-radiation",
    "three colours of light mix to make any colour": "color-vision",
    "some atoms soak up neutrons": "neutron-absorption",
    "a neutron turns one element into another": "neutron-bombardment",
    "mass grows with speed": "mass-increase",
    "total internal reflection": "refraction",
    "each stone pushes back as hard as it's pushed": "laws-motion",  # Arches, per Boris's comment Nov 14
}
NEW_EFFECTS.update(OBJECT_EFFECTS)
_B = "burns with oxygen from the air"
OBJECTS = {
    # approved earlier (EXTRA, round 3), repeated so the batch is complete
    "oil-lamp": [("capillary action", "approved earlier"), (_B, "borderline: see the burning row")],
    "candle": [("capillary action", "approved earlier"), (_B, "borderline: see the burning row")],
    "modern-candles": [("capillary action", ""), (_B, "borderline: see the burning row")],
    "raft": [("buoyancy", "approved earlier")],
    "river-boat": [("buoyancy", "approved earlier")],
    "fountain-pen": [("capillary action", "approved earlier")],
    "submarine": [("buoyancy", "approved earlier"), ("water pressure grows with depth", "approved earlier")],
    "bathysphere": [("water pressure grows with depth", "approved earlier")],
    "photographic-negative": [("light darkens silver salts", "approved earlier")],
    "dry-plates": [("light darkens silver salts", "approved earlier")],
    "masers": [("excited atoms copy the light passing through", "approved earlier")],
    "laser": [("excited atoms copy the light passing through", "approved earlier")],
    # time and maths
    "simple-sundial": [("the Earth's turning moves the shadow", "explained later")],
    "sundial": [("the Earth's turning moves the shadow", "the gnomon tilted to the Earth's axis; explained later")],
    "scale": [("a lever balances equal weights", "")],
    "abacus": [("place value", "each row a power of ten")],
    "calculating-machines": [("place value", "like the Adding machine")],
    "analytical-engine": [("place value", "like the Adding machine")],
    "slide-rules": [("adding logarithms multiplies numbers", "")],
    "computer": [("integration", "the differential analyzer's integrators")],
    "laser-disks": [("binary numbers", "digital encoding, like Microchips")],
    # forces and motion
    "basic-steam-engine": [("reaction thrust", "spins like a lawn sprinkler")],
    "maxim-gun": [("reaction thrust", "the recoil works the gun")],
    "couched-lance": [("momentum carries into the strike", "borderline")],
    "rudder": [("lift", "borderline")],
    "rifle": [("a spinning body holds its axis", "borderline")],
    "seismograph": [("a heavy mass stays put while the ground moves", "borderline")],
    "modern-seismograph": [("a heavy mass stays put while the ground moves", "borderline")],
    "longbow": [("elasticity", "no parts to carry it")],
    "arch": [("each stone pushes back as hard as it's pushed", "per your comment: action and reaction carry the load round the arch")],
    "macadamized-roads": [("rolling friction", "like Paved road")],
    "transatlantic-liner": [("buoyancy", "an iron ship floats, like Rafts and River boats")],
    "ironclad-warships": [("buoyancy", "like the Transatlantic liner")],
    "bathyscaphe": [("buoyancy", "its float of gasoline is lighter than water"), ("water pressure grows with depth", "")],
    "stratospheric-balloons": [("buoyancy", "its lift gas, Hydrogen, now has none")],
    "aqualung": [("water pressure grows with depth", "the regulator matches the water's pressure")],
    "ultracentrifuge": [("spinning pulls heavier particles outward", "its key effect, so the gap stays (rule 16)")],
    # heat
    "thermometer": [("liquids expand when heated", "borderline: new card")],
    "mercury-thermometer": [("liquids expand when heated", "borderline: new card")],
    "clinical-thermometer": [("liquids expand when heated", "borderline: new card")],
    "pressure-cooker": [("pressure raises water's boiling point", "its key effect, so the gap stays; shares the Boiling points gap with Liquor distillation")],
    "dewar-flask": [("a vacuum stops heat passing", "its key effect, so the gap stays (rule 16)"), ("heat radiates as invisible light", "the silvering reflects it")],
    "refrigerators": [("latent heat", "the evaporating refrigerant takes in heat")],
    "radiometer": [("gas molecules push harder off the warm side", "its card: 'vivid support for the kinetic theory'")],
    "matches": [("rubbing makes heat", "struck to light"), (_B, "borderline: see the burning row")],
    "gas-lighting": [(_B, "borderline: see the burning row")],
    "welsbach-mantle": [("hot things glow", "")],
    # air and water
    "barometer": [("atmospheric pressure", "explained later")],
    # light
    "eyeglass": [("refraction", "")],
    "concave-lenses": [("refraction", "")],
    "microscope": [("refraction", "")],
    "contact-lenses": [("refraction", "")],
    "camera": [("refraction", "its lens")],
    "fiber-optics": [("total internal reflection", "light can't leave the glass at a shallow angle")],
    "reflecting-telescope": [("a curved mirror focuses light", "")],
    "100-inch-telescope": [("a curved mirror focuses light", "")],
    "hubble-space-telescope": [("a curved mirror focuses light", ""), ("orbit", "")],
    "radio-telescope": [("a curved mirror focuses light", "the dish focuses radio waves")],
    "jodrell-bank": [("a curved mirror focuses light", "the dish")],
    "arecibo-radio-telescope": [("a curved mirror focuses light", "the dish")],
    "diffraction-gratings": [("light waves interfere", "")],
    "diffraction-gratings-improved": [("light waves interfere", "")],
    "interferometer": [("light waves interfere", "")],
    "phase-contrast-microscope": [("light waves interfere", "")],
    "practical-hologram": [("light waves interfere", "like Holography")],
    "very-long-baseline-array": [("light waves interfere", "radio waves from distant dishes combined")],
    "nicol-prism": [("some crystals split light in two", "")],
    "polaroid": [("some crystals pass light vibrating one way only", "")],
    "spectroheliograph": [("each gas glows its own colours", "it images the Sun in one element's line")],
    "ultramicroscope": [("small particles scatter light", "its key effect, so the gap stays (rule 16)")],
    "color-television": [("three colours of light mix to make any colour", "borderline")],
    # electricity and magnetism
    "compass": [("the Earth is a magnet", "explained later")],
    "static-electricity": [("static charge", "")],
    "lightning-rod": [("conduction", "")],
    "galvanometer": [("a current makes a magnet", "the current turns a compass needle")],
    "dry-cell": [("a reaction drives a current", "")],
    "lithium-battery": [("a reaction drives a current", "")],
    "electron-gun": [("thermionic emission", ""), ("electron beams", "")],
    "photocell": [("photoelectric effect", "")],
    "quartz-oscillator": [("piezoelectricity", "")],
    "pacemaker": [("muscles work by electrical impulses", "like Electrocardiogram")],
    # particles
    "mass-spectrometer": [("a magnet pushes a current", "the magnet bends the ions by mass")],
    "cyclotron": [("a magnet pushes a current", "the magnet curls the particles' path")],
    "synchrocyclotron": [("a magnet pushes a current", ""), ("mass grows with speed", "its card: the field is synchronized to the growing mass")],
    "betatron": [("a magnet pushes a current", ""), ("mass grows with speed", "its card")],
    "bevatron": [("a magnet pushes a current", ""), ("mass grows with speed", "")],
    "stellarator": [("a magnet pushes a current", "the field holds the hot gas")],
    "electron-microscope": [("electrons travel as waves", "its card: 'electron waves'")],
    "electron-microscope-improved": [("electrons travel as waves", "")],
    "field-emission-microscope": [("quantum tunnelling", "electrons leave the tip")],
    "field-ion-microscopes": [("quantum tunnelling", "")],
    "geiger-counter": [("radiation ionizes what it passes through", "borderline: new card")],
    "spark-chamber": [("radiation ionizes what it passes through", "borderline: new card")],
    "bubble-chambers": [("radiation ionizes what it passes through", "borderline: new card")],
    "nuclear-reactor": [("a neutron splits a heavy atom, freeing more neutrons", "its Uranium has none (rule 24)"), ("some atoms soak up neutrons", "the control rods")],
    "breeder-reactors": [("a neutron turns one element into another", "uranium-238 becomes plutonium")],
    # body
    "cardiac-catheter": [("X-rays pass through tissue unevenly", "the catheter shows on X-rays")],
    "perfusion-pump": [("cells live outside the body", "keeps organs alive")],
    "heart-lung-machine": [("the heart pumps blood around the body", "like Jarvik hearts (rule 25)")],
    "artificial-heart-implant": [("the heart pumps blood around the body", "like Jarvik hearts")],
    "artificial-kidneys": [("small molecules seep through a membrane", "")],
    "stethoscope": [("sound is a vibration", "borderline")],
    "phonograph": [("sound is a vibration", "borderline")],
    # space
    **{k: [("orbit", "like Sputnik")] for k in ["weather-satellites", "commercial-communications-satellites", "space-station", "earth-resources-satellites", "skylab", "space-shuttle"]},
}
OBJECT_NONE = [
    ("Through their parts (rule 23)", [
        "catapult", "crossbow", "aqueduct", "dome", "flying-buttress", "lighthouse", "wheelbarrow", "windmill",
        "telescope", "bifocal-lenses", "achromatic-microscopes", "large-refracting-telescope", "coronagraph", "spinning-frame",
        "working-steamboat", "steam-locomotive-improved", "mechanical-reaper", "hand-watch", "pulse-watch", "longitude",
        "mechanical-clock", "pendulum-clock", "cannon", "arquebus", "musket", "revolvers", "needle-gun", "machine-guns", "safety-pin",
        "cylinder-locks", "typewriters", "air-brake", "air-pump", "elevators", "electromechanical-calculator", "coincidence-counter",
        "particle-accelerator", "iconoscope", "television-in-the-home", "eniac", "univac", "pocket-calculators", "electronic-watch",
        "land-camera", "supersonic-flight", "supersonic-transport", "laser-printers", "controlled-fission-reactors",
        "nuclear-fission-bomb", "nuclear-fusion-bomb", "spray-cans", "scanning-electron-microscope", "linotype", "sewing-machine",
        "turnplow", "keys", "robots"]),
    ("Craft, structure or organization: no named effect (rule 28)", [
        "stone-tool", "pottery", "sickle", "jacquard-loom", "stocking-frame", "high-backed-saddle", "punched-cards", "plow", "stone-monument", "bridle", "saddle", "coin", "wooden-stirrup", "water-wheel",
        "iron-horseshoes", "horse-collar", "fork", "spinning-wheel", "pike", "artillery", "printing-press", "cross-hairs",
        "flying-shuttle", "franklin-stove", "cotton-gin", "surgical-gloves", "sutures", "mirror", "tungsten-wire",
        "long-playing-records", "escapement", "gun-lock", "water-clock"]),
    ("Its own effect's card (rule 9)", ["cloud-chamber", "gyroscope"]),
]
OBJECT_BORDERLINE = {
    "burning": ("Candles, Oil lamps, Modern candles, Matches, Gas lighting",
                "burns with oxygen from the air → Combustion",
                "We moved burning onto the fuel (Gasoline, Kerosene). Here the fuel is animal fat, whose card (Animals domesticated) has none, so without this the lamps and candles would show no burning at all. MY PICK: give it to them."),
    "ionizing": ("Geiger counter, Spark chamber, Bubble chambers",
                 "radiation ionizes what it passes through → a new card, Ionizing radiation",
                 "3 uses (the Spark chamber's through its Geiger counters), so it earns a phenomenon card (rule 16). No card in the deck states it; the Cloud chamber's is droplets forming, a different effect. MY PICK: add the card."),
    "expansion": ("Thermometer, Mercury thermometer, Clinical thermometer",
                  "liquids expand when heated → a new card, Thermal expansion",
                  "3 uses, so it earns a card (rule 16). Charles's law is only for gases. MY PICK: add the card."),
    "gyroscope": ("Rifle; Gyroscope",
                  "Rifle: a spinning body holds its axis → Gyroscope (1852, explained later). Gyroscope itself: none",
                  "The Gyroscope card's text describes the effect, so like Photography it's the card for it, and can't link to itself. MY PICK: yes."),
    "seismograph": ("Seismograph, Modern seismograph",
                    "a heavy mass stays put while the ground moves → Laws of motion (inertia)",
                    "The first named effect for Laws of motion, which you kept off the Stagecoach for having none. MY PICK: yes."),
    "acoustics": ("Stethoscope, Phonograph",
                  "sound is a vibration → Acoustics (1896, explained later)",
                  "Acoustics is the only sound card, but its text is about echoes in a lecture room: a stand-in (rule 9). MY PICK: yes, as a stand-in."),
    "color": ("Color television",
              "three colours of light mix to make any colour → Color vision (1959, explained later)",
              "Its text is a later theory of colour receptors that 'complements the RGB model': a stand-in. MY PICK: yes."),
    "lance": ("Couched lance", "momentum carries into the strike → Conservation of momentum",
              "Its own card says 'the full momentum of horse + rider transfers into the strike'. But it may be too general, like the Stagecoach. MY PICK: yes, since its text names it."),
    "rudder": ("Rudders", "lift → Aerodynamics",
               "A rudder is a blade in water, as a sail is in air (the Sail has lift). MY PICK: yes."),
    "arch": ("Architectural arches", "none",
             "An arch carries weight by squeezing its stones together. There's no card for it, and it's structure (rule 28). Domes, Aqueducts and Flying buttresses would also get it through the arch. MY PICK: none."),
}
