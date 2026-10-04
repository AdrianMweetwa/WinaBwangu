import { api } from "./api.js";
import { state } from "./state.js";
import { updateProfileIdentity } from "./profile.js";

export async function loadCoreData() {
  const requests = [
    api.get("/api/booths"),
    api.get("/api/services"),
    api.get("/api/transactions"),
    state.currentUser?.role === "system_admin" ? api.get("/api/users") : Promise.resolve([]),
  ];
  const [booths, services, transactions, users] = await Promise.all(requests);
  state.booths = booths;
  state.services = services;
  state.transactions = transactions;
  state.users = users;
  updateProfileIdentity(state.currentUser);
}
