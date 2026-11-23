# Rewrite Future Technology cards in the new style

Read STYLE.md (same folder) first: it has Boris's rules and two examples. Also available: board_cards.json (board cards: id, t=title, y=year, job), used_by_job.json (effects each job already uses), inventory.json (effects found on deck cards: card, effect, strength).

Your input file is a list of existing candidate cards. Some carry `borisNote`: Boris's own comment, which you must answer in the rewrite (e.g. if he asks why we'd need it, the how must open with that; if he asks why it never worked, the obstacle must say).

For each card output one JSON object:
{"id": same id, "drop": true/false, "dropWhy": "only if drop: one sentence, usually r14 (doesn't matter enough) or r5 (too weak)",
 "name": "...", "subtitle": "...", "how": "...", "obstacle": "...",
 "effects": [{"effect": "...", "card": "deck card id"}],  // first one is the card's existing effect (keep it unless r11 needs narrowing); add up to 2 more only where they genuinely make the device work better (r17), each with a real deck card id from inventory.json or the effect cards in used_by_job/existing data
 "parts": ["board card ids"]  // keep the existing parts unless clearly wrong; you may add one}

Drop sparingly (only clear r14/r5 failures), but do drop the ones Boris rejected. Keep `real` facts honest; don't invent dates. Write a JSON array to the output file you were given, then validate: same ids in the same order as the input, every part id in board_cards.json, every effect card id a deck card id (in inventory.json `card`/`alsoCards`, or a card id used in used_by_job via existing data; when unsure, keep the original effectCard). Reply only with: number dropped (ids), and your 3 favourite renames.
