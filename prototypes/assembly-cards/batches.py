# Batches of the deck's own inventions, added to the prototype one area at a time.
#
# Each invention's slots come from links.csv: the links between existing cards that
# were approved in the "Missing parts" audit. A batch adds what the audit couldn't:
# the invention's own job, slots for parts that have no card yet (or that the audit
# missed), and its natural phenomena.
#
# Entry: id: (own job, [extra slots], [phenomena])
# Extra slot: (part name, job, filler_id or None, gap_name or None, kind[, note]),
#   the same shape as in pilot_data.py.

IN, RUNS, WITH = "inside", "runs on", "made with"

# Supporting cards that a batch needs and that aren't in the deck.
NEW_CARDS = {
    "microphone": ("Microphone", "1876", "Turns the pressure of sound into a varying electric current. Bell's first telephone used a liquid transmitter; Edison and Hughes made carbon microphones in 1877–78."),
}

SUPPORT = {
    "microphone": ("turns sound into current", [
        ("diaphragm", "turns sound into motion", None, "Diaphragm", IN),
        ("carbon", "varies the current", None, "Carbon granules", IN, "Pressed carbon changes its resistance with the sound."),
    ], ["acoustics", "ohms-law"]),
}

# ---- 1. Electricity and communication ----
ELECTRICITY = {
    "static-electricity-improved": ("makes electricity", [], ["positive-negative-charge", "electrical-conductance"]),
    "leyden-jar": ("stores electricity", [
        ("coating", "carries current", None, "Metal foil", IN, "Foil inside and out; the glass between them holds the charge."),
    ], ["positive-negative-charge", "electrical-conductance"]),
    "daniell-cell": ("stores electricity", [
        ("electrodes", "carries current", None, "Zinc", IN),
    ], ["laws-of-electrolysis", "electrical-conductance"]),
    "fuel-cell": ("makes electricity", [
        ("electrolyte", "conducts ions", "sulfuric-acid", None, IN, "Grove's gas battery used dilute sulfuric acid."),
    ], ["decomposition-of-water", "platinum-as-catalyst", "laws-of-electrolysis"]),
    "telegraph": ("sends and receives signals", [], ["electromagnetism", "electrical-conductance"]),
    "wheatstone-bridge": ("measures resistance", [
        ("meter", "measures current", None, "Galvanometer", IN),
    ], ["ohms-law"]),
    "stock-ticker": ("sends and receives signals", [], ["electromagnetism"]),
    "telephone": ("sends and receives signals", [], ["acoustics", "electromagnetism"]),
    "electric-light": ("makes light", [], ["black-bodies", "ohms-law"]),
    "alternating-currents": ("distributes electricity", [], ["alternating-current-theory", "electromagnetism"]),
    "transformer": ("changes voltage", [
        ("core", "concentrates the field", None, "Soft iron core", IN),
    ], ["electromagnetism", "alternating-current-theory"]),
    "radio-antennas": ("radiates and catches waves", [
        ("detector", "detects radiation", None, "Coherer", IN),
    ], ["radio-waves", "maxwells-equations"]),
    "oscilloscope": ("shows the image", [
        ("screen", "makes light", None, "Phosphor screen", IN),
    ], ["cathode-rays", "charged-cathode-rays"]),
    "radio-waves-and-sound": ("sends and receives signals", [], ["radio-waves", "acoustics"]),
    "superheterodyne-receiver": ("amplifies a signal", [], ["radio-waves", "fourier-analysis"]),
    "sonar": ("detects objects", [
        ("transducer", "turns current into sound", None, "Quartz transducer", IN, "Langevin's quartz sent the ultrasonic ping."),
    ], ["piezoelectricity", "acoustics"]),
    "magnetrons": ("amplifies a signal", [
        ("cathode", "emits electrons", "tungsten-wire", None, IN),
        ("tube", "holds the contents", "glass", None, IN),
    ], ["electron-emission", "radio-waves"]),
    "radar": ("detects objects", [], ["radio-waves", "speed-of-light"]),
    "geissler-tubes": ("makes light", [], ["electricity-in-a-vacuum", "air-pressure"]),
    "neon-lights": ("makes light", [], ["spectral-lines", "cathode-rays"]),
    "nitrogen-filled-light-bulbs": ("makes light", [], ["black-bodies"]),
    "coolidge-tube": ("makes x-rays", [
        ("anode", "makes x-rays", "tungsten", None, IN, "A block of tungsten that the electrons strike."),
    ], ["x-rays", "edison-effect"]),
    "tunnel-diode": ("controls the current", [], ["particles-as-waves", "current-and-crystals"]),
    "light-emitting-diodes": ("makes light", [], ["current-and-crystals", "waves-as-particles"]),
}

BATCHES = [("Electricity and communication", ELECTRICITY)]
