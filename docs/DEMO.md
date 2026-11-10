# Milestone 2 demo

Use `npm run seed`, then `npm start`, and open `http://localhost:3000`. All seeded users use `Password123!`.

1. Log in as Mona (`mona@taskflow.test`). Open **Projects**, create a project, and add Karim (`karim@taskflow.test`) as a member.
2. Open that project. Create task A for Karim with **High** priority and tomorrow's due date. Open task A and set **Repeats** to **Weekly**. Create task B in the same project and add task A as its dependency.
3. Log out and log in as Karim. Within five seconds, the bell shows the new assignment. Open **Notifications** and choose **Mark as read**; the bell returns to zero.
4. Open **My tasks**. Filter by **High** and sort by **Earliest first**.
5. Open task A. Move it to **In Progress** and add a comment.
6. Move task A to **Done**. Open **My tasks** to see next week's copy. Open task B to see that it is no longer blocked.
7. Return to task A and show its status history with timestamps.

The seeded project also has tasks due today, tomorrow, and overdue. On startup the scheduler creates one due-soon reminder for an open task due today or tomorrow, and one overdue alert for its assignee and project manager. Repeated checks do not duplicate alerts. Completed tasks receive no further alerts.

## Checking the API with Postman

`docs/postman/TaskFlow.postman_collection.json` calls every endpoint in the same order as the demo above and checks each status code and response body.

1. `npm run seed`, then `npm start`.
2. In Postman: **Import** the file, open the collection, then **Run collection**.
3. Expected result: 69 requests, 118 checks, 0 failed. Run `npm run seed` again before a second run.
