# B2 — Alias Resolution & Candidate Selection

## B2.1 Alias resolution

- [ ] **B2.1.1 Resolve alias to candidate list**
      Produce ordered provider/model candidates from alias config.

- [ ] **B2.1.2 Enforce alias validity**
      Reject unknown or disabled aliases with clear error.

- [ ] **B2.1.3 Lock alias semantics**
      Define how unknown or disabled model aliases are rejected.

---

## B2.2 Candidate filtering

- [ ] **B2.2.1 Enforce stream compatibility**
      Filter candidates that cannot stream if streaming is required.

- [ ] **B2.2.2 Enforce context length constraints**
      Filter candidates that cannot handle input size.

- [ ] **B2.2.3 Apply region/vendor allowlists**
      Filter candidates based on tenant or platform constraints.

---

## B2.3 Primary candidate selection

- [ ] **B2.3.1 Implement cheapest strategy**
      Select lowest cost candidate from filtered list.

- [ ] **B2.3.2 Implement fastest strategy**
      Select lowest latency candidate (requires historical data).

- [ ] **B2.3.3 Implement quality strategy**
      Select highest capability candidate.

- [ ] **B2.3.4 Implement deterministic/pinned strategy**
      Select specific provider when explicitly requested.

- [ ] **B2.3.5 Select primary candidate**
      Choose first viable provider based on active strategy.
