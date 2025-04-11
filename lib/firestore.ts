import { getFirestore } from "firebase/firestore";
import { app } from "./firebase"; // Make sure `firebase.ts` exports `app`

const db = getFirestore(app);

export { db };