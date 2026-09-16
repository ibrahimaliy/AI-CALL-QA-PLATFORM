import { getGlobalStores } from "../src/lib/store/global-store";
import crypto from "crypto";

const stores = getGlobalStores();
let updated = 0;

for (const [key, utts] of stores.utterances.entries()) {
  utts.forEach((u, i) => {
    if (!u.id) {
      u.id = crypto.randomUUID();
      updated++;
    }
  });
}

stores.saveState();
console.log(`Updated ${updated} utterances with unique IDs.`);
