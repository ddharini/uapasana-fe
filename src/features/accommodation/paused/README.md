# Paused: per-person room allotment

Switched off on 2026-10-11. Rooms are now given to mandals as a block
(`MandalStay`), and each mandal's coordinator decides who sleeps where and
reports how many people are in each room. See `../mandal-stays.ts`.

Everything here is the allotment feature as it was — the allot dialog, room
rules, room-detail notices on WhatsApp, and the old `/accommodation` and
`/accommodation/places/:id` screens (`AllotmentScreen`, `AllotmentPlaceScreen`).
Nothing imports it, so it is not in the app bundle, but it still typechecks.

To bring it back:

1. upasana-be `src/routes/accommodationRoutes.ts`: uncomment the paused routes
   and the destructuring at the top.
2. upasana-be `src/controllers/registrationController.ts`: uncomment the
   `releaseStaleAllotments` calls and the `stayForDevotee` block in `mine`;
   `accommodationController.updatePlace` / `deletePlace`: uncomment the
   allotment checks.
3. Route the screens here from `App.tsx`, and put `RegistrationStay` back on
   `routes/RegistrationDetail.tsx` and `StayDetails` on
   `routes/EditMyRegistration.tsx`.

Allotments made before the pause are still in the `room_allotment` collection.
