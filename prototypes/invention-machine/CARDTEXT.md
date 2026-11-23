# Brief: card text for missing real inventions

You're writing the front of new cards for an "Assembly Cards" board: a timeline of real inventions,
each card showing what it is, and (later, not your job) its parts and the effects it works by.
Boris, the project owner, chose these inventions because the board (built from Asimov's 1993
Chronology of Science and Discovery) is missing them.

Input: a JSON list of {id, name, year, how, note}. `how` is a rough hint at parts/effects; `note`
is Boris's comment if any. Output: a JSON list, one object per input, in the same order:

    {"id": ..., "title": ..., "year": 1977, "inventor": ..., "location": ..., "type": "object",
     "description": ..., "draw": ..., "flag": ...}

- **id**: keep the input id.
- **title**: short card title, generic, never a brand (Boris's rule: LASIK -> "Laser eye surgery",
  MP3 -> "Compressed media", Bluetooth -> "Short-range wireless link"). Keep the input name unless
  it's awkward; say why in `flag` if you change it.
- **year**: the year of the first practical, working version that people used (not the first
  patent or paper, unless that is what history books give). Check it. Integers; BCE negative.
- **inventor**: the person(s) or organisation usually credited, short ("Martin Cooper, Motorola").
  Empty string if genuinely collective.
- **location**: the country, as the deck writes it ("United States", "Japan", "England", "Kenya").
- **type**: "object" (a device or machine), "material" (a substance or fibre), or "practice"
  (a method, system or service, e.g. container shipping, email, randomized controlled trial).
- **description**: 2-3 sentences, about 35-60 words, in the deck's voice. First what it does for
  people, in plain words; then how it works physically, concretely, with the key mechanism.
  No jargon without a plain gloss, no hype, no "revolutionized". British-neutral spelling is fine
  but be consistent within a card. Examples from the deck:
  - "The working memory of every computer. Each bit is a small electric charge parked on a
    microscopic capacitor next to a transistor switch. The charge leaks away, so the chip tops it
    up thousands of times a second."
  - "Heats food in a minute or two. A magnetron fills the box with microwaves, which water
    molecules soak up by jiggling back and forth billions of times a second, so the food heats
    from the inside while the plate stays cool."
  - "Reads a price at the checkout in a blink. A laser spot sweeps across printed stripes, and a
    photocell turns the flicker of reflected light, strong from the white gaps and weak from the
    black bars, into a number the computer looks up."
- **draw**: one or two sentences telling an illustrator exactly what to draw for the card's
  picture: a single clear subject, mid-shot, showing the working part so the mechanism is
  physically right. Spell out geometry that illustrators get wrong (what touches what, which way
  things turn, what's inside). No text, labels, logos or brand shapes. If the subject is a
  practice or something invisible (email, search engine, public-key encryption, randomized
  trial), pick one concrete, recognisable scene or object that stands for it. Past lessons: a
  ball mouse's rollers must press on the side of the ball with axles parallel to the desk; an
  ultrasound picture of a baby must come from a probe on a pregnant belly; a resonance picture
  needs visible build-up, not just a pendulum.
- **flag**: empty, or a short note on anything uncertain or worth Boris's attention (disputed
  date or inventor, a title change, overlap with another card).

Check facts (dates, inventors, places, how it works) with web search where you're not certain.
Be accurate rather than fast; one wrong date is worse than a slow card.
