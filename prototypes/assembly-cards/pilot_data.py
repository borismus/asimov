# Pilot assembly + phenomenon lists for the Assembly Cards prototype.
# Slot: (label, job, filler_id or None, gap_name or None, kind)  kind: part | ingredient | step
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
    "loudspeaker": ("Loudspeaker", "1876", "A coil and magnet move a diaphragm to turn current back into sound. Starts life as the telephone receiver."),
    "gps": ("GPS", "1978", "Satellites with atomic clocks broadcast the time; a receiver turns the delays into a position. It only works with relativity corrections."),
    "vitamin-pills": ("Vitamin pills & food fortification", "1924", "Adds the nutrients whose lack causes deficiency diseases: first to salt and milk, later as pills."),
}

DOMAINS = [
    ("Shared parts", "wheel-and-axle gear-train valve boiler piston-and-cylinder spring ball-bearing wing insulated-wire sail loudspeaker"),
    ("Steam power", "miners-friend newcomen-steam-engine steam-engine improved-steam-engine turbines steam-turbine"),
    ("Engines", "internal-combustion-engine four-stroke-engine diesel-engine liquid-fuel-rockets"),
    ("On land and water", "cart stagecoach carriage-springs bicycle rubber-tire first-automobile self-starter steam-locomotive steamboat steamship screw-propeller"),
    ("Flight", "hot-air-balloon parachute glider glider-improved dirigible airplane seaplanes helicopter jet-planes"),
    ("Electricity and radio", "electric-battery storage-battery simple-electromagnet electromagnets electric-motors electric-generators electronic-rectifier triode radio transistor integrated-circuits microchips photovoltaic-cells"),
    ("Space and GPS", "v-two sputnik communications-satellites atomic-clock gps"),
    ("Nutrition", "vitamin-pills"),
]

P, I, S = "part", "ingredient", "step"
G = lambda name: ("GAP", name)

CARDS = {
  # ---- shared parts ----
  "wheel-and-axle": ("rolls a load along the ground", [], ["lever-math"]),
  "gear-train": ("transmits rotation", [], ["lever-math"]),
  "valve": ("controls flow", [], ["air-pressure"]),
  "boiler": ("makes steam", [], ["latent-heat", "boyles-law", "combustion-and-phlogiston-theory-refinement"]),
  "piston-and-cylinder": ("turns pressure into motion", [], ["air-pressure", "boyles-law"]),
  "spring": ("stores mechanical energy", [], [G("Elasticity (Hooke's law)")]),
  "ball-bearing": ("reduces friction", [], [G("Rolling friction")]),
  "wing": ("provides lift", [], ["aerodynamics"]),
  "insulated-wire": ("carries current", [], ["electrical-conductance"]),
  "sail": ("provides thrust", [], ["aerodynamics", "trade-winds"]),
  "loudspeaker": ("turns current into sound", [
      ("magnet", "makes a magnetic field", None, "Permanent magnet", P),
      ("coil", "carries current", "insulated-wire", None, P),
  ], ["electromagnetism", "acoustics"]),

  # ---- steam ----
  "miners-friend": ("pumps water", [
      ("steam", "makes steam", "boiler", None, P),
      ("control", "controls flow", "valve", None, P),
      ("vessel", "holds steam to condense", None, "Receiving vessel", P),
  ], ["air-pressure", "latent-heat"]),
  "newcomen-steam-engine": ("provides power", [
      ("steam", "makes steam", "boiler", None, P),
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("control", "controls flow", "valve", None, P),
      ("linkage", "transmits motion", None, "Rocking beam", P),
  ], ["air-pressure", "latent-heat"]),
  "steam-engine": ("provides power", [
      ("steam", "makes steam", "boiler", None, P),
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("control", "controls flow", "valve", None, P),
      ("condensing", "condenses steam", None, "Separate condenser", P),
  ], ["latent-heat", "air-pressure"]),
  "improved-steam-engine": ("provides rotary power", [
      ("steam", "makes steam", "boiler", None, P),
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("control", "controls flow", "valve", None, P),
      ("rotary drive", "transmits rotation", "gear-train", None, P),
      ("speed control", "regulates speed", None, "Centrifugal governor", P),
  ], ["latent-heat", "laws-motion"]),
  "turbines": ("turns flow into rotation", [
      ("support", "reduces friction", "ball-bearing", None, P),
  ], ["laws-motion", "conservation-momentum"]),
  "steam-turbine": ("provides rotary power", [
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
      ("fuel", "stores chemical energy", None, "Coal gas", I),
  ], ["combustion-and-phlogiston-theory-refinement", "gas-laws", "steam-engine-efficiency"]),
  "four-stroke-engine": ("provides power", [
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("intake and exhaust", "controls flow", "valve", None, P),
      ("crank", "transmits rotation", None, "Crankshaft", P),
      ("ignition", "ignites fuel", None, "Spark plug", P),
      ("fuel", "stores chemical energy", None, "Gasoline", I),
  ], ["combustion-and-phlogiston-theory-refinement", "gas-laws", "boyles-law"]),
  "diesel-engine": ("provides power", [
      ("power stroke", "turns pressure into motion", "piston-and-cylinder", None, P),
      ("intake and exhaust", "controls flow", "valve", None, P),
      ("injection", "meters fuel", None, "Fuel injector", P),
      ("fuel", "stores chemical energy", None, "Diesel oil", I),
  ], ["gas-laws", "boyles-law", "high-pressure", "steam-engine-efficiency"]),
  "liquid-fuel-rockets": ("provides thrust", [
      ("oxidizer", "supplies oxygen", "liquid-oxygen", None, I),
      ("fuel", "stores chemical energy", None, "Gasoline", I),
      ("feed", "controls flow", "valve", None, P),
      ("chamber", "contains combustion", None, "Combustion chamber and nozzle", P),
  ], ["conservation-momentum", "laws-motion", "space-flight"]),

  # ---- land and water ----
  "cart": ("carries loads", [
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("motive force", "provides power", "animal-dom", None, P),
  ], ["lever-math"]),
  "stagecoach": ("carries passengers", [
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("suspension", "absorbs shocks", "carriage-springs", None, P),
      ("motive force", "provides power", "horse", None, P),
  ], ["laws-motion"]),
  "carriage-springs": ("absorbs shocks", [], [G("Elasticity (Hooke's law)")]),
  "bicycle": ("carries a person", [
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
  "first-automobile": ("carries people on roads", [
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
      ("motor", "provides rotary power", "electric-motors", None, P),
      ("power", "stores electricity", "storage-battery", None, P),
      ("wiring", "carries current", "insulated-wire", None, P),
  ], ["electromagnetism"]),
  "steam-locomotive": ("pulls loads on rails", [
      ("engine", "provides rotary power", "improved-steam-engine", None, P),
      ("wheels", "rolls a load along the ground", "wheel-and-axle", None, P),
      ("track", "guides the wheels", None, "Iron rails", P),
  ], ["laws-motion"]),
  "steamboat": ("moves a boat without wind", [
      ("engine", "provides rotary power", "improved-steam-engine", None, P),
      ("hull", "floats a load", "river-boat", None, P),
      ("thrust", "provides thrust", None, "Paddle wheel", P),
  ], ["hydrostatics", "laws-motion"]),
  "steamship": ("crosses oceans under steam", [
      ("engine", "provides rotary power", "improved-steam-engine", None, P),
      ("thrust", "provides thrust", "screw-propeller", None, P),
      ("backup thrust", "provides thrust", "sail", None, P),
      ("navigation", "finds direction", "compass", None, P),
      ("hull", "floats a load", None, "Iron hull", P),
  ], ["hydrostatics"]),
  "screw-propeller": ("provides thrust", [], ["laws-motion", "conservation-momentum"]),

  # ---- flight ----
  "hot-air-balloon": ("provides lift", [
      ("lift gas", "is lighter than air", "hydrogen", None, I),
      ("envelope", "holds the gas", None, "Gas-tight envelope", P),
  ], ["hydrostatics", "charles-law"]),
  "parachute": ("slows a fall", [
      ("canopy", "makes drag", None, "Canopy", P),
  ], ["aerodynamics", "air-pressure"]),
  "glider": ("flies without power", [
      ("lift", "provides lift", "wing", None, P),
  ], ["aerodynamics"]),
  "glider-improved": ("flies without power", [
      ("lift", "provides lift", "wing", None, P),
      ("control", "steers", None, "Weight-shift control", P),
  ], ["aerodynamics"]),
  "dirigible": ("flies powered and steered", [
      ("lift gas", "is lighter than air", "hydrogen", None, I),
      ("engine", "provides power", "four-stroke-engine", None, P),
      ("thrust", "provides thrust", "screw-propeller", None, P),
      ("frame", "bears the load", "aluminum", None, I),
  ], ["hydrostatics", "aerodynamics"]),
  "airplane": ("flies powered", [
      ("lift", "provides lift", "wing", None, P),
      ("engine", "provides power", "four-stroke-engine", None, P),
      ("thrust", "provides thrust", "screw-propeller", None, P),
      ("control", "steers", None, "Wing warping", P),
  ], ["aerodynamics", "laws-motion"]),
  "seaplanes": ("flies from water", [
      ("airframe", "flies powered", "airplane", None, P),
      ("floats", "floats a load", None, "Floats", P),
  ], ["hydrostatics"]),
  "helicopter": ("flies vertically", [
      ("rotor", "provides lift", "wing", None, P),
      ("engine", "provides power", "four-stroke-engine", None, P),
      ("transmission", "transmits rotation", "gear-train", None, P),
      ("anti-torque", "steers", None, "Tail rotor", P),
  ], ["aerodynamics", "conservation-momentum"]),
  "jet-planes": ("flies fast", [
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
  "electric-motors": ("provides rotary power", [
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
  "electronic-rectifier": ("lets current flow one way", [
      ("bulb", "emits electrons", "electric-light", None, P),
      ("plate", "collects electrons", None, "Metal plate", P),
  ], ["edison-effect"]),
  "triode": ("amplifies a signal", [
      ("tube", "lets current flow one way", "electronic-rectifier", None, P),
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
      ("semiconductor", "turns light into current", "silicon", None, I),
  ], ["photoelectric-effect"]),

  # ---- space and GPS ----
  "v-two": ("delivers a payload", [
      ("engine", "provides thrust", "liquid-fuel-rockets", None, P),
      ("guidance", "holds direction", "gyroscope", None, P),
  ], ["conservation-momentum", "universal-gravitation"]),
  "sputnik": ("orbits and transmits", [
      ("launcher", "provides thrust", "liquid-fuel-rockets", None, P),
      ("transmitter", "sends and receives signals", "radio", None, P),
      ("power", "stores electricity", "electric-battery", None, P),
  ], ["universal-gravitation", "laws-motion", "radio-waves"]),
  "communications-satellites": ("relays signals", [
      ("launcher", "provides thrust", "liquid-fuel-rockets", None, P),
      ("transponder", "sends and receives signals", "radio", None, P),
      ("amplifier", "amplifies a signal", "transistor", None, P),
      ("power", "makes electricity", "photovoltaic-cells", None, P),
  ], ["universal-gravitation", "radio-waves"]),
  "atomic-clock": ("keeps time", [
      ("reference", "keeps time", None, "Cesium beam tube", P),
      ("oscillator", "keeps time", None, "Quartz oscillator", P),
  ], ["molecular-beams", "magnetic-resonance"]),
  "gps": ("finds position", [
      ("satellites", "relays signals", "communications-satellites", None, P),
      ("clocks", "keeps time", "atomic-clock", None, P),
      ("signal", "sends and receives signals", "radio", None, P),
      ("receiver", "computes and switches", "microchips", None, P),
  ], ["general-relativity", "special-relativity", "gravitational-red-shift", "geometry", "radio-waves"]),

  # ---- nutrition (a recipe: ingredients and a step) ----
  "vitamin-pills": ("prevents deficiency disease", [
      ("vitamin A", "prevents night blindness", "vitamins-a-and-b", None, I),
      ("vitamin D", "prevents rickets", None, None, S),  # placeholder replaced below
      ("vitamin E", "protects cells", "vitamin-e", None, I),
      ("vitamin C", "prevents scurvy", "ascorbic-acid", None, I),
      ("vitamin B2", "supports metabolism", "riboflavin", None, I),
      ("vitamin B1", "prevents beriberi", "thiamine", None, I),
      ("niacin", "prevents pellagra", "niacin", None, I),
      ("vitamin K", "lets blood clot", "vitamin-k", None, I),
      ("iodine", "prevents goiter", "essential-minerals", None, I),
      ("biotin", "supports metabolism", "biotin", None, I),
      ("vitamin B12", "prevents pernicious anemia", "cyanocobalamin", None, I),
  ], ["vitamin-concept", "dietary-deficiency-diseases", "rickets", "scurvy", "pellagra"]),
}

# Vitamin D comes from irradiating food: a process step filled by the Irradiation card.
CARDS["vitamin-pills"][1][1] = ("vitamin D", "prevents rickets", "irradiation", None, S)
