import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Dummy secrets — encryption.ts / webhook-signature.ts read these
    // at module load. Tests never hit a real Meta/Supabase service, so
    // any 32-byte hex / non-empty string will do; keep them lexically
    // identical to the CI build env so behaviour matches.
    //
    // The TEST_SUPABASE_* trio is opt-in for the cross-org isolation
    // suite (src/lib/orgs/isolation.test.ts). When absent, the suite
    // `skipIf`s itself — CI without secrets stays green. When present
    // (locally via .env.test or in CI via GitHub Secrets), they're
    // forwarded into the test process here.
    env: {
      ENCRYPTION_KEY:
        "0000000000000000000000000000000000000000000000000000000000000000",
      META_APP_SECRET: "test-meta-app-secret",
      TEST_SUPABASE_URL: process.env.TEST_SUPABASE_URL ?? "",
      TEST_SUPABASE_ANON_KEY: process.env.TEST_SUPABASE_ANON_KEY ?? "",
      TEST_SUPABASE_SERVICE_ROLE_KEY:
        process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
    clearMocks: true,
  },
});
