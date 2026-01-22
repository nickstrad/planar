# B1 — Routing Primitives & Configuration

## B1.1 Routing input context

- [ ] **B1.1.1 Define routing input context type**
      Include tenantId, alias, stream requirement, and capability constraints.

- [ ] **B1.1.2 Define resolved model contract**
      Standardize provider + model + parameters output shape.

- [ ] **B1.1.3 Define routing plan snapshot type**
      Include primary candidate, fallback chain, and decision metadata.

---

## B1.2 Model catalog configuration

- [ ] **B1.2.1 Define model catalog config shape**
      Describe models with provider id, model name, streaming support, context limits, and cost rates.

- [ ] **B1.2.2 Define model alias mapping config**
      Map model aliases to ordered provider/model candidates.

- [ ] **B1.2.3 Create routing config module**
      Centralize alias → provider/model mapping in server-only module.

- [ ] **B1.2.4 Validate routing config at startup**
      Use Zod to fail fast if alias mappings reference unknown providers or models.

---

## B1.3 Provider capability registry

- [ ] **B1.3.1 Define provider capabilities interface**
      Specify streaming support, max context, supported features per provider.

- [ ] **B1.3.2 Query capabilities from Project A adapters**
      Integrate with runtime to get live provider capabilities.

- [ ] **B1.3.3 Enforce capability gating**
      Prevent routing to providers that do not meet request requirements.
