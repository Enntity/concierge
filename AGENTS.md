# Concierge Agent Notes

## Full-Stack Verification

Use the real local stack for browser and file-contract verification. Do not add fallback code to make concierge pass when Cortex or Cortex File Handler are down.

Start dependencies first:

- Start both outside the sandbox so they pick up their own repo-root `.env` files.
- `cd /Users/jmac/software/ml/enntity/cortex/helper-apps/cortex-file-handler && npm run dev`
- `cd /Users/jmac/software/ml/enntity/cortex && npm start > run.log 2>&1`

From `/Users/jmac/software/ml/enntity/concierge`, run:

- `npm run build`
- `npm test -- --runInBand instrumentation.test.js src/__tests__/App.test.js src/components/chat/MessageInput.test.js src/components/common/UnifiedFileManager/__tests__/useUnifiedFileData.test.js src/components/common/UnifiedFileManager/__tests__/FileManager.fileId.test.js src/components/common/UnifiedFileManager/__tests__/FileContentArea.test.js src/components/common/UnifiedFileManager/__tests__/UnifiedFileManager.mobile.test.js src/components/common/UnifiedFileManager/__tests__/UnifiedFileManager.selection.test.js`
- `set -a; source .env.local; set +a; node scripts/product-smoke.mjs`

Smoke expectations:

- Cortex GraphQL is reachable on the URL from `CORTEX_GRAPHQL_API_URL` or `http://127.0.0.1:4000/graphql`
- Cortex File Handler is reachable on the URL from `CORTEX_MEDIA_API_URL` or `http://127.0.0.1:7071/media-helper`
- `scripts/product-smoke.mjs` should fail if either dependency is unavailable
