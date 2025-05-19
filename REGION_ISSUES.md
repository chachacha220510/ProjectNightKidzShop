# Region ID Issues in Medusa E-commerce

This document explains the common region ID synchronization issues between environments and how to resolve them in the NightKidz Shop project.

## Understanding the Problem

Region IDs in Medusa are unique identifiers in the format `reg_XXXXXXXXXXXXXXXXXXXX`. When importing data between environments (e.g., from production to local development), region ID references can become problematic because:

1. The imported data contains references to regions that might not exist in the target environment
2. Frontend caches and localStorage may store region IDs from one environment that don't exist in another
3. The specific region ID `reg_01JVK89Q8PEA1EMJS7FPBN12VF` is known to cause issues

This leads to errors like:

- "Region with ID reg_01JVK89Q8PEA1EMJS7FPBN12VF not found"
- Cart initialization failures
- Checkout process errors

## Tables That Reference Region IDs

Region IDs can be found in many tables across the database:

- `cart` - Carts are associated with a specific region
- `customer` - Customers may have a default region
- `discount_condition_region` - Discounts can be region-specific
- `discount_region` - Discounts can be limited to regions
- `order` - Orders are placed in a specific region
- `payment_collection` - Payment collections are tied to regions
- `payment_session` - Payment sessions are region-specific
- `shipping_option` - Shipping options apply to specific regions

## How We Handle Region ID Issues

This project includes multiple ways to handle region ID synchronization:

### 1. Automatic Fix During Database Import

When running `setup-local-db.js` and importing production data, the script:

1. Scans for problematic region IDs
2. Identifies available regions in the local database
3. Updates all references to missing region IDs with a valid local region ID
4. Prioritizes using a USD region when available

### 2. Manual Fix via Script

You can manually fix region issues using:

```bash
./restart-dev.sh --fix-regions
```

### 3. Standalone Fix Script

For more control, use the dedicated region fix script:

```bash
node fix-regions.js
```

This interactive script:

1. Asks which region ID needs to be replaced
2. Shows available regions in your database
3. Lets you select which region to use as a replacement
4. Updates all references across all relevant tables

## Client-Side Solutions

Even after fixing database references, you may need to clear client-side caches:

1. Browser localStorage cleanup:

   - Open developer tools (F12)
   - Go to Application > Storage > Local Storage
   - Delete entries for localhost:8000
   - Also clear sessionStorage

2. Frontend cache cleanup:

   - The `restart-dev.sh` script automatically cleans Next.js caches
   - It also creates a utility at `storefront/src/lib/reset-store.js` that can be used in your code

3. Redux store reset:

   - If your storefront uses Redux Persist, you can use the generated utility to clear persistent state:

   ```javascript
   import { resetPersistedStore } from "../lib/reset-store";

   // In your component/page
   const handleResetStore = () => {
     resetPersistedStore();
     window.location.reload();
   };
   ```

## Preventing Future Issues

To minimize region ID issues:

1. Always use `setup-local-db.js` when importing production data
2. Run `./restart-dev.sh --fix-regions` after importing data
3. Clear browser caches when switching between environments
4. Consider adding a visible "Reset Store" button in development mode

## Technical Implementation Details

Our region fix approach ensures:

1. All database references are updated atomically
2. Tables are checked for existence before attempting updates
3. Columns are verified to contain region_id before modifications
4. Preferential selection of USD regions to maintain currency consistency
