# Pilot assembly + phenomenon lists for the Assembly Cards prototype.
# Slot: (part name, job, filler_id or None, gap_name or None, kind[, note])  kind: inside | runs on | made with
# The job is the key. The part name is shown only when it adds something (see build.py part_name).
# Jobs are kept generic (see the "Job merges" audit); a slot's specifics go in the optional note.
# Phenomenon entry: card id, or ("GAP", "name") for a phenomenon with no card in the deck.

NEW_CARDS = {
    "wheel-and-axle": ("Wheel and axle", "-3500", "A wheel fixed to a turning axle: the simple machine that lets loads roll instead of drag."),
    "gear-train": ("Gear train", "-250", "Toothed wheels that pass rotation along while trading speed for force."),
    "valve": ("Valve", "-250", "A part that opens and closes a passage so fluid flows when and where it should."),
    "boiler": ("Boiler", "1698", "A closed vessel over a fire that turns water into steam under pressure."),
    "piston-and-cylinder": ("Piston and cylinder", "1690", "A sliding plug in a tight tube: pressure on one side becomes straight-line motion."),
    "wing": ("Wing (airfoil)", "1804", "A curved surface that makes lift as air flows over it. Cayley's glider made it a separate part of the machine."),
    "ball-bearing": ("Ball bearing", "1869", "Hardened balls in a race that let a shaft turn with little friction. First patented for bicycles."),
    "insulated-wire": ("Insulated wire & cable", "1840", "Copper wire wrapped in insulation so current goes only where it is sent."),
    "spring": ("Spring (coil & mainspring)", "1500", "Coiled metal that stores energy when it is bent and gives it back."),
    "sail": ("Sail", "-3500", "Cloth set to the wind to push a boat or turn a mill."),
    "rare-earth-magnet": ("Rare-earth magnet", "1966", "A permanent magnet made from rare-earth metals, far stronger than steel. Samarium-cobalt came first; neodymium magnets followed in 1984."),
    "loudspeaker": ("Loudspeaker", "1876", "A coil and magnet move a diaphragm to turn current back into sound. Starts life as the telephone receiver."),
    "gps": ("GPS", "1978", "Satellites with atomic clocks broadcast the time; a receiver turns the delays into a position. It only works with relativity corrections."),
    "vitamin-pills": ("Vitamin pills & food fortification", "1924", "Adds the nutrients whose lack causes deficiency diseases: first to salt and milk, later as pills."),
}

DOMAINS = [
    ("Shared parts", "wheel-and-axle gear-train valve boiler piston-and-cylinder spring ball-bearing wing insulated-wire sail loudspeaker rare-earth-magnet"),
    ("Steam power", "miners-friend newcomen-steam-engine steam-engine improved-steam-engine turbines steam-turbine"),
    ("Engines", "internal-combustion-engine four-stroke-engine diesel-engine liquid-fuel-rockets"),
    ("On land and water", "cart stagecoach carriage-springs bicycle rubber-tire first-automobile self-starter steam-locomotive steamboat steamship screw-propeller"),
    ("Flight", "hot-air-balloon parachute glider glider-improved dirigible airplane seaplanes helicopter jet-planes"),
    ("Electricity and radio", "electric-battery storage-battery simple-electromagnet electromagnets electric-motors electric-generators electronic-rectifier triode radio transistor integrated-circuits microchips photovoltaic-cells"),
    ("Space and GPS", "v-two sputnik communications-satellites atomic-clock gps"),
    ("Nutrition", "vitamin-pills"),
]

IN = "inside"       # physically in the finished thing: parts and materials
RUNS = "runs on"    # used up while it works: fuel, propellant, film
WITH = "made with"  # used to make or do it, but not in the result
P = I = IN          # older shorthand: parts and materials are both "inside"
S = WITH
G = lambda name: ("GAP", name)

CARDS = {
  # ---- shared parts ----
  "wheel-and-axle": ("rolls a load along the ground", [], ["lever-math"]),
  "gear-train": ("transmits rotation", [
      ("material", "forms the body", "bronze", None, IN, "The Antikythera mechanism's gears are bronze."),
  ], ["lever-math"]),
  "valve": ("controls flow", [
      ("material", "forms the body", "bronze", None, IN),
  ], ["air-pressure"]),
  "boiler": ("makes steam", [
      ("shell", "forms the body", "copper", None, IN, "Early boilers were copper, later wrought iron."),
  ], ["latent-heat", "boyles-law", "combustion-and-phlogiston-theory-refinement"]),
  "piston-and-cylinder": ("turns pressure into motion", [
      ("material", "forms the body", "bronze", None, IN, "Early cylinders were brass, later cast iron."),
  ], ["air-pressure", "boyles-law"]),
  "spring": ("stores energy", [
      ("material", "forms the body", "steel", None, IN),
  ], [G("Elasticity (Hooke's law)")]),
  "ball-bearing": ("reduces friction", [
      ("material", "forms the body", "steel", None, IN),
  ], [G("Rolling friction")]),
  "wing": ("provides lift", [
      ("skin and spars", "forms the body", "aluminum", None, IN, "All-metal wings came later; early wings were cloth on wood."),
  ], ["aerodynamics"]),
  "insulated-wire": ("carries current", [
      ("conductor", "carries current", "copper", None, I),
      ("insulation", "insulates", "vulcanization-of-rubber", None, I, "Gutta-percha, used for submarine cable, has no card."),
  ], ["electrical-conductance"]),
  "sail": ("provides thrust", [
      ("cloth", "forms the body", "fish-nets", None, IN),
  ], ["aerodynamics", "trade-winds"]),
  "rare-earth-magnet": ("makes a magnetic field", [
      ("samarium", "forms the body", "thulium-holmium-samarium", None, IN),
      ("cobalt", "forms the body", "cobalt", None, IN),
      ("neodymium", "forms the body", "praseodymium-and-neodymium", None, IN, "Neodymium magnets came in 1984."),
      ("dysprosium", "forms the body", "dysprosium", None, IN, "Keeps neodymium magnets strong when hot."),
  ], ["magnetic-moments"]),
  "loudspeaker": ("turns current into sound", [
      ("magnet", "makes a magnetic field", "rare-earth-magnet", None, IN, "Early speakers used electromagnets or steel magnets."),
      ("coil", "carries current", "insulated-wire", None, P),
  ], ["electromagnetism", "acoustics"]),

  # ---- steam ----
  "miners-friend": ("pumps water", [
      ("steam", "makes steam", "boiler", None, P),
      ("control", "controls flow", "valve", None, P),
      ("vessel", "condenses steam", None, "Receiving vessel", P),
  ], ["air-pressure", "latent-heat"]),
  "newcomen-steam-engine": ("provides power", [
      ("steam", "makes steam", "boiler", None, P),
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("control", "controls flow", "valve", None, P),
      ("linkage", "transmits rotation", None, "Rocking beam", P),
  ], ["air-pressure", "latent-heat"]),
  "steam-engine": ("provides power", [
      ("steam", "makes steam", "boiler", None, P),
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("control", "controls flow", "valve", None, P),
      ("condensing", "condenses steam", None, "Separate condenser", P),
  ], ["latent-heat", "air-pressure"]),
  "improved-steam-engine": ("provides power", [
      ("steam", "makes steam", "boiler", None, P),
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("control", "controls flow", "valve", None, P),
      ("rotary drive", "transmits rotation", "gear-train", None, P),
      ("speed control", "regulates speed", None, "Centrifugal governor", P),
  ], ["latent-heat", "laws-motion"]),
  "turbines": ("turns flow into rotation", [
      ("support", "reduces friction", "ball-bearing", None, P),
  ], ["laws-motion", "conservation-momentum"]),
  "steam-turbine": ("provides power", [
      ("steam", "makes steam", "boiler", None, P),
      ("rotor", "turns flow into rotation", "turbines", None, P),
      ("control", "controls flow", "valve", None, P),
      ("support", "reduces friction", "ball-bearing", None, P),
  ], ["conservation-momentum", "gas-laws"]),

  # ---- engines ----
  "internal-combustion-engine": ("provides power", [
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("control", "controls flow", "valve", None, P),
      ("ignition", "ignites fuel", None, "Spark plug", P),
      ("fuel", "stores chemical energy", "gas-lighting", None, RUNS, "Lenoir burned coal gas from the gas works."),
  ], ["combustion-and-phlogiston-theory-refinement", "gas-laws", "steam-engine-efficiency"]),
  "four-stroke-engine": ("provides power", [
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("intake and exhaust", "controls flow", "valve", None, P),
      ("crank", "transmits rotation", None, "Crankshaft", P),
      ("ignition", "ignites fuel", None, "Spark plug", P),
      ("fuel", "stores chemical energy", None, "Gasoline", RUNS),
  ], ["combustion-and-phlogiston-theory-refinement", "gas-laws", "boyles-law"]),
  "diesel-engine": ("provides power", [
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("intake and exhaust", "controls flow", "valve", None, P),
      ("injection", "meters fuel", None, "Fuel injector", P),
      ("fuel", "stores chemical energy", "kerosene", None, RUNS, "Diesel's 1897 engine ran on kerosene."),
  ], ["gas-laws", "boyles-law", "high-pressure", "steam-engine-efficiency"]),
  "liquid-fuel-rockets": ("provides thrust", [
      ("oxidizer", "supplies oxygen", "liquid-oxygen", None, RUNS),
      ("fuel", "stores chemical energy", None, "Gasoline", RUNS),
      ("feed", "controls flow", "valve", None, P),
      ("chamber", "contains combustion", None, "Combustion chamber and nozzle", P),
  ], ["conservation-momentum", "laws-motion", "space-flight"]),

  # ---- land and water ----
  "cart": ("transports people or goods", [
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("motive force", "provides power", "animal-dom", None, P),
  ], ["lever-math"]),
  "stagecoach": ("transports people or goods", [
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("suspension", "absorbs shocks", "carriage-springs", None, P),
      ("motive force", "provides power", "horse", None, P),
  ], ["laws-motion"]),
  "carriage-springs": ("absorbs shocks", [
      ("material", "forms the body", "steel", None, IN),
  ], [G("Elasticity (Hooke's law)")]),
  "bicycle": ("transports people or goods", [
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("drive", "transmits rotation", "gear-train", None, P),
      ("tires", "absorbs shocks", "rubber-tire", None, P),
      ("bearings", "reduces friction", "ball-bearing", None, P),
      ("steering", "steers", None, "Handlebars", P),
      ("frame", "bears the load", "steel", None, I),
  ], ["laws-motion", "conservation-momentum"]),
  "rubber-tire": ("absorbs shocks", [
      ("casing", "seals air", "vulcanization-of-rubber", None, I),
      ("inflation", "controls flow", "valve", None, P),
  ], ["air-pressure"]),
  "first-automobile": ("transports people or goods", [
      ("engine", "provides power", "four-stroke-engine", None, P),
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("tires", "absorbs shocks", "rubber-tire", None, P),
      ("suspension", "absorbs shocks", "carriage-springs", None, P),
      ("transmission", "transmits rotation", "gear-train", None, P),
      ("bearings", "reduces friction", "ball-bearing", None, P),
      ("starter", "starts the engine", "self-starter", None, P),
      ("steering", "steers", None, "Steering wheel", P),
  ], ["laws-motion"]),
  "self-starter": ("starts the engine", [
      ("motor", "provides power", "electric-motors", None, P),
      ("power", "stores electricity", "storage-battery", None, P),
      ("wiring", "carries current", "insulated-wire", None, P),
  ], ["electromagnetism"]),
  "steam-locomotive": ("transports people or goods", [
      ("engine", "provides power", "improved-steam-engine", None, P),
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("track", "guides the wheels", None, "Iron rails", P),
  ], ["laws-motion"]),
  "steamboat": ("transports people or goods", [
      ("engine", "provides power", "improved-steam-engine", None, P),
      ("hull", "floats a load", "river-boat", None, P),
      ("thrust", "provides thrust", None, "Paddle wheel", P),
  ], ["hydrostatics", "laws-motion"]),
  "steamship": ("transports people or goods", [
      ("engine", "provides power", "improved-steam-engine", None, P),
      ("thrust", "provides thrust", "screw-propeller", None, P),
      ("backup thrust", "provides thrust", "sail", None, P),
      ("navigation", "finds direction", "compass", None, P),
      ("hull", "floats a load", None, "Iron hull", P),
  ], ["hydrostatics"]),
  "screw-propeller": ("provides thrust", [
      ("material", "forms the body", "bronze", None, IN),
  ], ["laws-motion", "conservation-momentum"]),

  # ---- flight ----
  "hot-air-balloon": ("provides lift", [
      ("lift gas", "provides lift", "hydrogen", None, I),
      ("envelope", "holds the contents", "silk-europe", None, IN, "Charles's hydrogen balloon used rubberized silk."),
  ], ["hydrostatics", "charles-law"]),
  "parachute": ("slows a fall", [
      ("canopy", "makes drag", "silk-europe", None, IN),
  ], ["aerodynamics", "air-pressure"]),
  "glider": ("flies", [
      ("lift", "provides lift", "wing", None, P),
  ], ["aerodynamics"]),
  "glider-improved": ("flies", [
      ("lift", "provides lift", "wing", None, P),
      ("control", "steers", None, "Weight-shift control", P),
  ], ["aerodynamics"]),
  "dirigible": ("flies", [
      ("lift gas", "provides lift", "hydrogen", None, I),
      ("engine", "provides power", "four-stroke-engine", None, P),
      ("thrust", "provides thrust", "screw-propeller", None, P),
      ("frame", "bears the load", "aluminum", None, I),
  ], ["hydrostatics", "aerodynamics"]),
  "airplane": ("flies", [
      ("lift", "provides lift", "wing", None, P),
      ("engine", "provides power", "four-stroke-engine", None, P),
      ("thrust", "provides thrust", "screw-propeller", None, P),
      ("control", "steers", None, "Wing warping", P),
  ], ["aerodynamics", "laws-motion"]),
  "seaplanes": ("flies", [
      ("airframe", "flies", "airplane", None, P),
      ("floats", "floats a load", None, "Floats", P),
  ], ["hydrostatics"]),
  "helicopter": ("flies", [
      ("rotor", "provides lift", "wing", None, P),
      ("engine", "provides power", "four-stroke-engine", None, P),
      ("transmission", "transmits rotation", "gear-train", None, P),
      ("anti-torque", "steers", None, "Tail rotor", P),
  ], ["aerodynamics", "conservation-momentum"]),
  "jet-planes": ("flies", [
      ("lift", "provides lift", "wing", None, P),
      ("thrust", "provides thrust", None, "Jet engine", P),
  ], ["aerodynamics", "laws-motion", "conservation-momentum"]),

  # ---- electricity and radio ----
  "electric-battery": ("stores electricity", [
      ("electrodes", "carries current", "copper", None, I),
      ("electrolyte", "conducts ions", None, "Brine", I),
  ], ["laws-of-electrolysis"]),
  "storage-battery": ("stores electricity", [
      ("plates", "carries current", None, "Lead plates", I),
      ("electrolyte", "conducts ions", "sulfuric-acid", None, I),
  ], ["laws-of-electrolysis"]),
  "simple-electromagnet": ("makes a magnetic field", [
      ("coil", "carries current", "insulated-wire", None, P),
      ("power", "stores electricity", "electric-battery", None, P),
  ], ["electromagnetism"]),
  "electromagnets": ("makes a magnetic field", [
      ("coil", "carries current", "insulated-wire", None, P),
      ("core", "concentrates the field", None, "Soft iron core", P),
      ("power", "stores electricity", "electric-battery", None, P),
  ], ["electromagnetism"]),
  "electric-motors": ("provides power", [
      ("field", "makes a magnetic field", "electromagnets", None, P),
      ("windings", "carries current", "insulated-wire", None, P),
      ("bearings", "reduces friction", "ball-bearing", None, P),
      ("power", "stores electricity", "electric-battery", None, P),
  ], ["electromagnetism", "electrical-motion"]),
  "electric-generators": ("makes electricity", [
      ("field", "makes a magnetic field", "electromagnets", None, P),
      ("windings", "carries current", "insulated-wire", None, P),
      ("bearings", "reduces friction", "ball-bearing", None, P),
  ], ["electromagnetism", "electrical-motion"]),
  "electronic-rectifier": ("controls the current", [
      ("bulb", "emits electrons", "electric-light", None, P),
      ("plate", "collects electrons", None, "Metal plate", P),
  ], ["edison-effect"]),
  "triode": ("amplifies a signal", [
      ("tube", "controls the current", "electronic-rectifier", None, P),
      ("grid", "controls the current", None, "Control grid", P),
  ], ["edison-effect", "electron-emission"]),
  "radio": ("sends and receives signals", [
      ("antenna", "radiates and catches waves", "radio-antennas", None, P),
      ("amplifier", "amplifies a signal", "triode", None, P),
      ("output", "turns current into sound", "loudspeaker", None, P),
      ("power", "stores electricity", "electric-battery", None, P),
  ], ["radio-waves", "maxwells-equations", "kennelly-heaviside-layer"]),
  "transistor": ("amplifies a signal", [
      ("semiconductor", "controls the current", "germanium", None, I),
      ("leads", "carries current", None, "Contact wires", P),
  ], ["fermi-dirac-statistics"]),
  "integrated-circuits": ("computes and switches", [
      ("switches", "amplifies a signal", "transistor", None, P),
      ("substrate", "holds the circuit", "silicon", None, I),
  ], ["fermi-dirac-statistics"]),
  "microchips": ("computes and switches", [
      ("circuit", "computes and switches", "integrated-circuits", None, P),
      ("clock", "keeps time", None, "Quartz oscillator", P),
  ], ["binary-system", "symbolic-logic"]),
  "photovoltaic-cells": ("makes electricity", [
      ("semiconductor", "makes electricity", "silicon", None, I),
  ], ["photoelectric-effect"]),

  # ---- space and GPS ----
  "v-two": ("delivers a payload", [
      ("engine", "provides thrust", "liquid-fuel-rockets", None, P),
      ("guidance", "holds direction", "gyroscope", None, P),
  ], ["conservation-momentum", "universal-gravitation"]),
  "sputnik": ("sends and receives signals", [
      ("launcher", "provides thrust", "liquid-fuel-rockets", None, WITH, "The rocket puts it in orbit but isn't part of it."),
      ("transmitter", "sends and receives signals", "radio", None, P),
      ("power", "stores electricity", "electric-battery", None, P),
  ], ["universal-gravitation", "laws-motion", "radio-waves"]),
  "communications-satellites": ("sends and receives signals", [
      ("launcher", "provides thrust", "liquid-fuel-rockets", None, WITH, "The rocket puts it in orbit but isn't part of it."),
      ("transponder", "sends and receives signals", "radio", None, P),
      ("amplifier", "amplifies a signal", "transistor", None, P),
      ("power", "makes electricity", "photovoltaic-cells", None, P),
  ], ["universal-gravitation", "radio-waves"]),
  "atomic-clock": ("keeps time", [
      ("reference", "keeps time", None, "Cesium beam tube", P),
      ("oscillator", "keeps time", None, "Quartz oscillator", P),
  ], ["molecular-beams", "magnetic-resonance"]),
  "gps": ("finds position", [
      ("satellites", "sends and receives signals", "communications-satellites", None, P),
      ("clocks", "keeps time", "atomic-clock", None, P),
      ("signal", "sends and receives signals", "radio", None, P),
      ("receiver", "computes and switches", "microchips", None, P),
  ], ["general-relativity", "special-relativity", "gravitational-red-shift", "geometry", "radio-waves"]),

  # ---- nutrition (a recipe: ingredients and a step) ----
  "vitamin-pills": ("prevents deficiency disease", [
      ("vitamin A", "supplies a nutrient", "vitamins-a-and-b", None, I, "prevents night blindness"),
      ("vitamin D", "supplies a nutrient", None, None, S),  # placeholder replaced below
      ("vitamin E", "supplies a nutrient", "vitamin-e", None, I, "protects cells"),
      ("vitamin C", "supplies a nutrient", "ascorbic-acid", None, I, "prevents scurvy"),
      ("vitamin B2", "supplies a nutrient", "riboflavin", None, I, "supports metabolism"),
      ("vitamin B1", "supplies a nutrient", "thiamine", None, I, "prevents beriberi"),
      ("niacin", "supplies a nutrient", "niacin", None, I, "prevents pellagra"),
      ("vitamin K", "supplies a nutrient", "vitamin-k", None, I, "lets blood clot"),
      ("iodine", "supplies a nutrient", "essential-minerals", None, I, "prevents goiter"),
      ("biotin", "supplies a nutrient", "biotin", None, I, "supports metabolism"),
      ("vitamin B12", "supplies a nutrient", "cyanocobalamin", None, I, "prevents pernicious anemia"),
  ], ["vitamin-concept", "dietary-deficiency-diseases", "rickets", "scurvy", "pellagra"]),
}

# Vitamin D comes from irradiating food: a process step filled by the Irradiation card.
CARDS["vitamin-pills"][1][1] = ("vitamin D", "supplies a nutrient", "irradiation", None, S, "prevents rickets")
