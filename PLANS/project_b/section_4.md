# B4 — Cost Estimation & Policy Engine

## B4.1 Cost modeling

- [ ] **B4.1.1 Define cost rate structure**
      Specify input/output token rates per provider/model.

- [ ] **B4.1.2 Estimate pre-inference cost**
      Calculate expected cost based on input size and model rates.

- [ ] **B4.1.3 Calculate post-inference cost**
      Compute actual cost from token counts after completion.

---

## B4.2 Policy constraints

- [ ] **B4.2.1 Define hard constraint types**
      Max context length, streaming required, region allowlist, vendor allowlist.

- [ ] **B4.2.2 Define soft constraint types**
      Cost preference, latency preference, quality preference.

- [ ] **B4.2.3 Apply constraints during candidate filtering**
      Hard constraints eliminate candidates; soft constraints rank them.

---

## B4.3 Cost-aware routing

- [ ] **B4.3.1 Include cost in routing decision**
      Factor estimated cost into candidate selection.

- [ ] **B4.3.2 Respect tenant cost caps**
      Integrate with Gateway quota checks for cost-based limits.

- [ ] **B4.3.3 Emit cost estimates in routing response**
      Return expected cost to Gateway for preflight checks.
