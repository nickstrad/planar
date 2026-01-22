# F1 — Pricing & Plans

## F1.1 Pricing models

- [ ] **F1.1.1 Define pricing dimensions**
      Input tokens, output tokens, requests, compute time.

- [ ] **F1.1.2 Define per-model pricing**
      Rate cards per provider/model combination.

- [ ] **F1.1.3 Define markup/margin structure**
      Platform margin on top of provider costs.

---

## F1.2 Plan definitions

- [ ] **F1.2.1 Define plan tiers**
      Free, Pro, Enterprise with different limits.

- [ ] **F1.2.2 Define plan quota limits**
      Monthly tokens, monthly cost, concurrency per tier.

- [ ] **F1.2.3 Define plan feature gates**
      Which models/providers available per tier.

- [ ] **F1.2.4 Store plan definitions**
      Prisma models for plans and tenant assignments.

---

## F1.3 Quota policy integration

- [ ] **F1.3.1 Define what counts toward usage**
      Successful requests only, or all attempts.

- [ ] **F1.3.2 Define overage behavior**
      Hard stop, soft warning, or pay-as-you-go.

- [ ] **F1.3.3 Expose plan limits to Gateway**
      Provide quota definitions for enforcement.

---

## F1.4 Cost tracking

- [ ] **F1.4.1 Track cost per request**
      Record actual cost from Router (Project B).

- [ ] **F1.4.2 Aggregate cost per tenant**
      Sum costs for billing period.

- [ ] **F1.4.3 Generate usage reports**
      Per-tenant cost breakdown by model/time.
