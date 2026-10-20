# Domain models (Fady)

Plain objects that describe our data: `User`, `Project`, `Task`, `Comment`, `Notification`, plus fixed values like `TaskStatus` and `Priority`.

Rules: no database code, no HTTP, no imports from other layers. Follow the class diagram from Milestone 1.
Use `Object.freeze` for fixed lists, e.g. `TaskStatus = Object.freeze({ TODO: 'TODO', IN_PROGRESS: 'IN_PROGRESS', IN_REVIEW: 'IN_REVIEW', DONE: 'DONE' })`.
