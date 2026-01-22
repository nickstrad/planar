# A7 — Configuration & Extensibility

> **Purpose**: Centralize runtime configuration for the inference system, including provider setup, operational limits, and environment-based controls.

**Depends on**:
- A2 (Types) — uses `ExecutionControls`, `ProviderCapabilities`
- A4 (Adapters) — configures `providerRegistry`

**File location**: `src/lib/inference/config/`

---

## A7.1 Provider Configuration

### A7.1.1 Define provider config shape

```typescript
// src/lib/inference/config/providers.ts
import type { ProviderCapabilities } from "../types";

/**
 * Configuration for a single provider.
 */
export interface ProviderConfig {
  /** Provider identifier (e.g., "openai", "ollama") */
  providerId: string;

  /** Whether this provider is enabled */
  enabled: boolean;

  /** API endpoint (for providers that support custom endpoints) */
  endpoint?: string;

  /** API key environment variable name */
  apiKeyEnvVar?: string;

  /** Provider-specific options */
  options?: Record<string, unknown>;

  /** Override default capabilities */
  capabilities?: Partial<ProviderCapabilities>;
}

/**
 * Complete inference configuration.
 */
export interface InferenceConfig {
  /** Configured providers */
  providers: ProviderConfig[];

  /** Default execution controls */
  defaults: {
    timeoutMs: number;
    maxRetries: number;
  };

  /** Operational limits */
  limits: OperationalLimits;
}

/**
 * Operational limits for inference.
 */
export interface OperationalLimits {
  /** Maximum messages per request */
  maxMessages: number;

  /** Maximum input size in characters */
  maxInputSize: number;

  /** Maximum concurrent requests per provider */
  maxConcurrentPerProvider: number;
}
```

---

### A7.1.2 Create server-only config module

```typescript
// src/lib/inference/config/index.ts
import "server-only";
import { z } from "zod";
import { env } from "@/lib/env/server";
import type { InferenceConfig, ProviderConfig } from "./providers";

/**
 * Zod schema for provider configuration.
 */
const providerConfigSchema = z.object({
  providerId: z.string().min(1),
  enabled: z.boolean(),
  endpoint: z.string().url().optional(),
  apiKeyEnvVar: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for inference configuration.
 */
const inferenceConfigSchema = z.object({
  providers: z.array(providerConfigSchema),
  defaults: z.object({
    timeoutMs: z.number().int().min(1000).max(300000),
    maxRetries: z.number().int().min(0).max(5),
  }),
  limits: z.object({
    maxMessages: z.number().int().min(1).max(1000),
    maxInputSize: z.number().int().min(1).max(10_000_000),
    maxConcurrentPerProvider: z.number().int().min(1).max(100),
  }),
});

/**
 * Build configuration from environment.
 */
function buildConfig(): InferenceConfig {
  const providers: ProviderConfig[] = [];

  // OpenAI configuration
  if (env.OPENAI_API_KEY) {
    providers.push({
      providerId: "openai",
      enabled: true,
      apiKeyEnvVar: "OPENAI_API_KEY",
    });
  }

  // Ollama configuration
  providers.push({
    providerId: "ollama",
    enabled: true,
    endpoint: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  });

  return {
    providers,
    defaults: {
      timeoutMs: 60_000,
      maxRetries: 1,
    },
    limits: {
      maxMessages: 100,
      maxInputSize: 1_000_000, // ~1MB
      maxConcurrentPerProvider: 10,
    },
  };
}

/**
 * Validated inference configuration.
 * Fails fast at startup if invalid.
 */
export const inferenceConfig: InferenceConfig = inferenceConfigSchema.parse(
  buildConfig()
);

/**
 * Get config for a specific provider.
 */
export function getProviderConfig(providerId: string): ProviderConfig | undefined {
  return inferenceConfig.providers.find((p) => p.providerId === providerId);
}

/**
 * Get list of enabled provider IDs.
 */
export function getEnabledProviders(): string[] {
  return inferenceConfig.providers
    .filter((p) => p.enabled)
    .map((p) => p.providerId);
}
```

---

## A7.2 Environment-Based Controls

### A7.2.1 Provider enablement by environment

```typescript
// src/lib/inference/config/environment.ts
import { env } from "@/lib/env/server";

type Environment = "development" | "test" | "production";

/**
 * Provider availability by environment.
 */
const PROVIDER_AVAILABILITY: Record<string, Environment[]> = {
  openai: ["development", "test", "production"],
  anthropic: ["development", "test", "production"],
  ollama: ["development", "test"], // Local only
  "llama.cpp": ["development", "test"], // Local only
};

/**
 * Check if a provider is available in current environment.
 */
export function isProviderAvailable(providerId: string): boolean {
  const environments = PROVIDER_AVAILABILITY[providerId];
  if (!environments) return false;
  return environments.includes(env.NODE_ENV as Environment);
}

/**
 * Get providers available in current environment.
 */
export function getAvailableProviders(): string[] {
  return Object.entries(PROVIDER_AVAILABILITY)
    .filter(([_, envs]) => envs.includes(env.NODE_ENV as Environment))
    .map(([id]) => id);
}
```

---

### A7.2.2 Required secrets validation

```typescript
// src/lib/inference/config/secrets.ts
import { env } from "@/lib/env/server";

/**
 * Required secrets per provider.
 */
const REQUIRED_SECRETS: Record<string, string[]> = {
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  ollama: [], // No secrets required
};

/**
 * Check if a provider has all required secrets.
 */
export function hasRequiredSecrets(providerId: string): boolean {
  const required = REQUIRED_SECRETS[providerId] ?? [];
  return required.every((key) => {
    const value = (env as Record<string, string | undefined>)[key];
    return value !== undefined && value.length > 0;
  });
}

/**
 * Get missing secrets for a provider.
 */
export function getMissingSecrets(providerId: string): string[] {
  const required = REQUIRED_SECRETS[providerId] ?? [];
  return required.filter((key) => {
    const value = (env as Record<string, string | undefined>)[key];
    return value === undefined || value.length === 0;
  });
}
```

---

### A7.2.3 Safe local defaults

```typescript
// src/lib/inference/config/defaults.ts
import type { ExecutionControls, InferenceOptions } from "../types";

/**
 * Default inference options for development.
 */
export const DEV_INFERENCE_OPTIONS: InferenceOptions = {
  maxTokens: 1024,
  temperature: 0.7,
  stream: true,
};

/**
 * Default execution controls for development.
 */
export const DEV_EXECUTION_CONTROLS: ExecutionControls = {
  timeoutMs: 120_000, // 2 minutes (more lenient for local models)
  maxRetries: 2,
};

/**
 * Default inference options for production.
 */
export const PROD_INFERENCE_OPTIONS: InferenceOptions = {
  maxTokens: 4096,
  temperature: 0.7,
  stream: true,
};

/**
 * Default execution controls for production.
 */
export const PROD_EXECUTION_CONTROLS: ExecutionControls = {
  timeoutMs: 60_000, // 1 minute
  maxRetries: 1,
};

/**
 * Get defaults for current environment.
 */
export function getDefaults(nodeEnv: string): {
  inferenceOptions: InferenceOptions;
  executionControls: ExecutionControls;
} {
  if (nodeEnv === "production") {
    return {
      inferenceOptions: PROD_INFERENCE_OPTIONS,
      executionControls: PROD_EXECUTION_CONTROLS,
    };
  }
  return {
    inferenceOptions: DEV_INFERENCE_OPTIONS,
    executionControls: DEV_EXECUTION_CONTROLS,
  };
}
```

---

## A7.3 Operational Limits

### A7.3.1 Per-provider timeout configuration

```typescript
// src/lib/inference/config/timeouts.ts

/**
 * Per-provider timeout overrides (in milliseconds).
 */
const PROVIDER_TIMEOUTS: Record<string, number> = {
  openai: 60_000,    // 1 minute
  anthropic: 90_000, // 1.5 minutes (Claude can be slower)
  ollama: 180_000,   // 3 minutes (local models vary)
};

/**
 * Get timeout for a provider.
 */
export function getProviderTimeout(providerId: string, defaultMs: number): number {
  return PROVIDER_TIMEOUTS[providerId] ?? defaultMs;
}
```

---

### A7.3.2 Retry configuration

```typescript
// src/lib/inference/config/retry.ts

/**
 * Retry configuration per provider.
 */
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const PROVIDER_RETRY_CONFIG: Record<string, RetryConfig> = {
  openai: { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 10000 },
  anthropic: { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 10000 },
  ollama: { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 5000 },
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 1,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Get retry config for a provider.
 */
export function getRetryConfig(providerId: string): RetryConfig {
  return PROVIDER_RETRY_CONFIG[providerId] ?? DEFAULT_RETRY_CONFIG;
}

/**
 * Calculate delay with exponential backoff.
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: RetryConfig
): number {
  const delay = config.baseDelayMs * Math.pow(2, attemptNumber);
  return Math.min(delay, config.maxDelayMs);
}
```

---

### A7.3.3 Input limits configuration

```typescript
// src/lib/inference/config/limits.ts
import type { Message } from "../types";

/**
 * Per-provider input limits.
 */
interface InputLimits {
  maxMessages: number;
  maxInputCharacters: number;
  maxTokensEstimate: number; // Rough estimate for context window
}

const PROVIDER_INPUT_LIMITS: Record<string, InputLimits> = {
  openai: {
    maxMessages: 100,
    maxInputCharacters: 500_000,
    maxTokensEstimate: 128_000,
  },
  anthropic: {
    maxMessages: 100,
    maxInputCharacters: 800_000,
    maxTokensEstimate: 200_000,
  },
  ollama: {
    maxMessages: 50,
    maxInputCharacters: 32_000,
    maxTokensEstimate: 8_000,
  },
};

const DEFAULT_INPUT_LIMITS: InputLimits = {
  maxMessages: 50,
  maxInputCharacters: 100_000,
  maxTokensEstimate: 8_000,
};

/**
 * Get input limits for a provider.
 */
export function getInputLimits(providerId: string): InputLimits {
  return PROVIDER_INPUT_LIMITS[providerId] ?? DEFAULT_INPUT_LIMITS;
}

/**
 * Validate messages against provider limits.
 */
export function validateMessageLimits(
  messages: Message[],
  providerId: string
): { valid: boolean; error?: string } {
  const limits = getInputLimits(providerId);

  if (messages.length > limits.maxMessages) {
    return {
      valid: false,
      error: `Too many messages: ${messages.length} > ${limits.maxMessages}`,
    };
  }

  const totalCharacters = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalCharacters > limits.maxInputCharacters) {
    return {
      valid: false,
      error: `Input too large: ${totalCharacters} > ${limits.maxInputCharacters} characters`,
    };
  }

  return { valid: true };
}
```

---

### A7.3.4 Fail-closed behavior

```typescript
// src/lib/inference/config/startup.ts
import { getEnabledProviders, getProviderConfig } from "./index";
import { hasRequiredSecrets, getMissingSecrets } from "./secrets";
import { isProviderAvailable } from "./environment";

/**
 * Startup validation result.
 */
interface StartupValidation {
  valid: boolean;
  enabledProviders: string[];
  disabledProviders: Array<{ providerId: string; reason: string }>;
  warnings: string[];
}

/**
 * Validate configuration at startup.
 * Fails fast if no providers are available.
 */
export function validateStartup(): StartupValidation {
  const result: StartupValidation = {
    valid: false,
    enabledProviders: [],
    disabledProviders: [],
    warnings: [],
  };

  for (const providerId of getEnabledProviders()) {
    // Check environment availability
    if (!isProviderAvailable(providerId)) {
      result.disabledProviders.push({
        providerId,
        reason: `Not available in ${process.env.NODE_ENV} environment`,
      });
      continue;
    }

    // Check required secrets
    if (!hasRequiredSecrets(providerId)) {
      const missing = getMissingSecrets(providerId);
      result.disabledProviders.push({
        providerId,
        reason: `Missing secrets: ${missing.join(", ")}`,
      });
      continue;
    }

    result.enabledProviders.push(providerId);
  }

  // Fail if no providers are available
  result.valid = result.enabledProviders.length > 0;

  if (!result.valid) {
    result.warnings.push("No providers available. Inference will fail.");
  }

  return result;
}

/**
 * Initialize inference system.
 * Throws if configuration is invalid.
 */
export function initializeInference(): void {
  const validation = validateStartup();

  if (!validation.valid) {
    throw new Error(
      `Inference initialization failed: ${validation.warnings.join("; ")}`
    );
  }

  console.log(`Inference initialized with providers: ${validation.enabledProviders.join(", ")}`);

  for (const disabled of validation.disabledProviders) {
    console.warn(`Provider ${disabled.providerId} disabled: ${disabled.reason}`);
  }
}
```

---

## Tasks

### A7.1 Provider configuration

- [ ] **A7.1.1 Define ProviderConfig and InferenceConfig types**
- [ ] **A7.1.2 Create server-only config module with Zod validation**
- [ ] **A7.1.3 Implement getProviderConfig and getEnabledProviders**

### A7.2 Environment-based controls

- [ ] **A7.2.1 Implement provider availability by environment**
- [ ] **A7.2.2 Implement required secrets validation**
- [ ] **A7.2.3 Create environment-specific defaults**

### A7.3 Operational limits

- [ ] **A7.3.1 Configure per-provider timeouts**
- [ ] **A7.3.2 Configure retry behavior with backoff**
- [ ] **A7.3.3 Configure input limits per provider**
- [ ] **A7.3.4 Implement fail-closed startup validation**

---

## A7.4 Unit Tests

**File**: `src/lib/inference/__tests__/config/`

- [ ] **A7.4.1 Test provider configuration** (`providers.test.ts`)
      - Config schema validates correct structure
      - Config schema rejects invalid timeoutMs (too low/high)
      - Config schema rejects invalid maxRetries
      - `getProviderConfig` returns config for known provider
      - `getProviderConfig` returns undefined for unknown provider
      - `getEnabledProviders` returns only enabled providers

- [ ] **A7.4.2 Test environment controls** (`environment.test.ts`)
      - `isProviderAvailable` returns true for allowed environments
      - `isProviderAvailable` returns false for disallowed environments
      - `getAvailableProviders` filters by current NODE_ENV
      - Local-only providers (ollama) not available in production

- [ ] **A7.4.3 Test secrets validation** (`secrets.test.ts`)
      - `hasRequiredSecrets` returns true when all secrets present
      - `hasRequiredSecrets` returns false when secrets missing
      - `getMissingSecrets` returns list of missing env vars
      - Providers with no required secrets always pass

- [ ] **A7.4.4 Test limits configuration** (`limits.test.ts`)
      - `getInputLimits` returns provider-specific limits
      - `getInputLimits` returns defaults for unknown provider
      - `validateMessageLimits` passes valid input
      - `validateMessageLimits` fails on too many messages
      - `validateMessageLimits` fails on input too large

- [ ] **A7.4.5 Test retry configuration** (`retry.test.ts`)
      - `getRetryConfig` returns provider-specific config
      - `calculateRetryDelay` uses exponential backoff
      - `calculateRetryDelay` respects maxDelayMs cap

- [ ] **A7.4.6 Test startup validation** (`startup.test.ts`)
      - `validateStartup` returns valid=true with at least one provider
      - `validateStartup` returns valid=false with no providers
      - `validateStartup` lists disabled providers with reasons
      - `initializeInference` throws when no providers available
      - `initializeInference` logs warnings for disabled providers
