# Check the big-job Future Technologies before Boris sees them

Your input file holds candidate cards (fields described in BIGJOBS.md, which you should skim for the
"big" bar). Boris rejects cards that already exist, so the most important check is prior art.

For each card:
1. **Exists?** Use WebSearch (2-3 queries) for a product, deployment, funded startup or pilot plant
   that does this job this way. Startups count: if a company is already building essentially this
   (e.g. Deep Fission building reactors in boreholes), it exists. A lab paper alone does not.
   Record what you found, with a URL.
2. **Rules**: drop if it fails one clearly:
   - exists (step 1)
   - r5 too weak: the effect can't plausibly do the job at a useful size
   - big: it wouldn't move the job's 10x target; a niche or incremental gain is out
   - r19 improvement: a better part for an existing device, same who/where/cost
   - vague: a wish, not a mechanism ("cure cancer with nanobots")
3. Verdict: `drop` (name the rule, one plain sentence), `pass` (one sentence on what it makes
   possible), or `borderline` (one sentence naming the question, ending "My pick: keep." or
   "My pick: drop."). At most 1 in 4 borderline.
4. Correct `familiar` if needed: true if it's a widely discussed moonshot or active research
   programme by name.

Write a JSON array to your output file, one per input card, same order:
{"id": "...", "verdict": "drop|pass|borderline", "rule": "exists|r5|big|r19|vague|none",
 "why": "one plain sentence", "found": "what the search found, or 'nothing deployed'",
 "url": "best source URL or empty", "familiar": true/false}
Reply only with counts per verdict and the names of the passes.
