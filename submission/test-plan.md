# Wina Bwangu Test Plan

This test plan records the checks carried out by our group to verify the application before submission. Each member can repeat the cases below using the same seeded data and demo accounts.

## Test environment

- Start the server with `npm start`.
- Open `http://localhost:3000`.
- Reseed first with `node database\\seed.js`.
- Demo password for the three accounts is `password123`.
- Test accounts: `admin` (system administrator), `admin_agent` (admin agent), and `agent` (agent).

## Functional and regression cases

| ID | Area | Test action | Expected result | Status |
|---|---|---|---|---|
| AUTH-01 | Login | Sign in with each valid demo username and password | Correct dashboard access is granted for each role | Pass |
| AUTH-02 | Login | Submit an incorrect password | Login is rejected with clear feedback | Pass |
| AUTH-03 | Logout | Select Logout, then revisit the dashboard URL | Session ends and the user is redirected to login | Pass |
| AUTH-04 | Recovery | Open Forgot password and submit an invalid email | Validation feedback is shown without a server error | Pass |
| RBAC-01 | System administrator | Open Users and Settings | Management actions are visible and usable | Pass |
| RBAC-02 | Admin agent | Open Users and attempt configuration changes | Users is unavailable; configuration is view-only | Pass |
| RBAC-03 | Agent | Open the dashboard and transaction page | Only assigned operational data/actions are available | Pass |
| RBAC-04 | API security | Send a protected API request without a session | API returns HTTP 401 | Pass |
| DATA-01 | Booth form | Select a booth | Its location and valid services are displayed | Pass |
| DATA-02 | Service form | Select a service at a booth | Required phone/account field matches the service | Pass |
| DATA-03 | Validation | Submit an empty, negative or invalid transaction | Submission is blocked with field feedback | Pass |
| TAX-01 | Calculation | Enter K1,000 in the transaction form | Tax is K160.00 and amount after tax is K840.00 | Pass |
| TAX-02 | API integrity | Send altered tax/revenue values to POST /api/transactions | Server stores its own 16% and service-rate calculations | Pass |
| CRUD-01 | Create | Create a booth, service or user | Confirmation then success modal appears; row refreshes | Pass |
| CRUD-02 | Update | Edit a booth, service or user | Confirmation then success modal appears; new values persist | Pass |
| CRUD-03 | Delete | Delete an allowed record | Confirmation is required and success feedback appears | Pass |
| TRANS-01 | Transaction | Process a valid deposit and withdrawal | Confirmation modal appears before save; recent activity updates | Pass |
| TRANS-02 | Receipt | Complete a transaction and choose Print Receipt | Browser print dialog opens with receipt content | Pass |
| DASH-01 | Dashboard | Review summary cards after seeding | Revenue, count, capital K740,000 and six booths are shown | Pass |
| DASH-02 | Dashboard | Review service and booth tables/charts | Service limits, booth revenue/frequency and pie charts match data | Pass |
| LIST-01 | Recent activity | Move between pages and apply filters | Correct page, count and filtered rows are shown | Pass |
| UI-01 | Modal layout | Open a tall user/settings modal and scroll | Header/footer remain fixed; body scrolls internally without page overflow | Pass |
| UI-02 | Responsive layout | Test desktop, tablet and mobile widths | Cards, tables, forms and modals remain usable | Pass |
| REG-01 | Regression | Refresh while signed in as a restricted role | Restricted navigation does not flash before access controls apply | Pass |

## Automated tests

We run `npm test` as part of our final verification. The suite verifies password hashing, shared validation, role capabilities, the 308 sequential transaction references and the server-side 16% monetary calculation. A clean run is required before submission.

## Confirmed assignment dataset

Our group is using the confirmed Appendix 1 dataset of 308 sequential transactions, with references from `WB0000001` through `WB0000308`. The seeded application data is reproducible and auditable. Run `npm run seed` before the final demonstration to restore this exact dataset.
