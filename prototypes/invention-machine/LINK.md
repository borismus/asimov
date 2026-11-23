# Link the new effect cards into the assembly graph

Boris curated ~138 new phenomenon cards (effects). They go onto the assembly board at
invention.cards/assembly, but a phenomenon card only appears there if some card "works by" it.
Your job: for each effect in your input file, find the board cards that work by it, following the
board's own rules exactly.

Read first:
- prototypes/assembly-cards/RULES.md, rules 9 and 21-28 (Phenomena). Above all rule 23 (own level:
  an effect a part already has isn't repeated on the whole) and rule 28 (no nameable effect, no
  link; a material's property doesn't count).
- prototypes/assembly-cards/PHENOMENA.md for how the existing 300 links were decided.
- prototypes/invention-machine/link_board.json: every card on the board (id, title, year, type,
  job, parts, worksBy = its current phenomenon links {effect, card} or {effect, gap}).

For each effect card in your input:
1. Look for board cards whose own job works directly by this effect and where the effect is not
   already covered: no existing worksBy link names the same effect, and no part carries it.
   Typical wins: a card whose worksBy has a `gap` (no card yet) that this effect describes; a card
   with no worksBy at all whose key effect this is; a card linked to a broad card (e.g. Optics,
   Laws of motion) where this card states the effect more directly (rule 9: one card per effect,
   the one that states it most directly). For the last kind, propose a `replace` of that link.
2. Be strict. The board links only key, nameable effects. "None" is a fine and common answer:
   expect many effects to have no board card that works by them yet (their uses are modern).
3. Write the effect phrase the way existing links do: plain, present tense, about the effect
   ("a vacuum stops heat passing", "a current makes a magnet").
4. If the effect has no year, give the year it was first described and by whom, if you know it
   reliably (one line of source); otherwise leave null.

Output: a JSON array to your output file, one item per input effect, same order:
{"id": "effect id", "links": [{"card": "board card id", "effect": "phrase", "op": "add|replace|fillGap",
  "replaces": "old card id or gap name, if op isn't add", "why": "one sentence"}],
 "year": null or number, "inventor": null or "name", "location": null or "country"}
Validate with a short script that every card id is in link_board.json. Don't use the web.
Reply only with: number of effects with at least one link, total links, and 5 examples.
