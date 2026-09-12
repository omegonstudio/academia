# Route Map — Academia

> Source of truth for application navigation and planned routes.
> Update this file in every PR that adds, changes, removes or materially changes a route.

Legend:
- `[x]` Implemented and validated
- `[~]` Partially implemented
- `[ ]` Planned
- `[!]` Blocked / decision required

## Stage 0 — Repository & Product Foundation

- [ ] `/` — public academy landing
- [ ] `/about` — academy information
- [ ] `/courses` — public educational offerings
- [ ] `/teachers` — public teacher/academy information
- [ ] `/contact` — contact
- [ ] `/login` — real authentication
- [ ] `/dashboard` — role-aware private entry

TODO:
- Audit existing routes before creating duplicates.
- Confirm existing auth implementation.
- Confirm existing API/DB/ORM.
- Establish Omegon design tokens from existing project assets.
- Establish SEO metadata foundation.
- Establish WCAG 2.2 AA baseline.

## Stage 1 — Identity, Roles & Permissions

- [ ] `/dashboard/settings`
- [ ] `/dashboard/administratives`
- [ ] `/dashboard/permissions`

TODO:
- Real role authorization.
- Director-managed Administrative permissions.
- SuperAdmin bootstrap for `omegon.info@gmail.com`.
- Backend authorization tests.
- Audit sensitive permission changes.

## Stage 2 — Students & Teachers

- [ ] `/dashboard/students`
- [ ] `/dashboard/students/[id]`
- [ ] `/dashboard/teachers`
- [ ] `/dashboard/teachers/[id]`

TODO:
- Student CRUD.
- Teacher CRUD.
- Levels.
- Status.
- Basic profiles.
- Ownership/access rules.

## Stage 3 — Assignments & Academic Structure

- [ ] `/dashboard/assignments`
- [ ] `/dashboard/courses`
- [ ] `/dashboard/courses/[id]`
- [ ] `/dashboard/groups`
- [ ] `/dashboard/groups/[id]`

TODO:
- Student → teacher assignment.
- Prevent teacher self-assignment.
- 1:1 service configuration.
- Group max 15 validation.
- Teacher-training course/group model.
- Enrollment history.

## Stage 4 — Classes & Calendar

- [ ] `/dashboard/classes`
- [ ] `/dashboard/classes/[id]`
- [ ] `/dashboard/calendar`

TODO:
- 60/90-minute 1:1 classes.
- 120-minute group classes.
- Recurrence support where appropriate.
- Teacher/student membership.
- Zoom/Google Meet link.
- Attendance.
- Class notes.
- Conflict detection.
- Timezone handling.

## Stage 5 — Materials

- [ ] `/dashboard/materials`
- [ ] `/dashboard/materials/[id]`

TODO:
- Upload/manage PDF, audio, image and links.
- Attach material to class/course.
- Student access control.
- Teacher upload permissions.
- File size/type validation.

## Stage 6 — Finance & Settlements

- [ ] `/dashboard/finance`
- [ ] `/dashboard/finance/students/[id]`
- [ ] `/dashboard/finance/teachers/[id]`

TODO:
- Student price.
- Payment status.
- Academy 15%.
- Teacher 85%.
- Period-based settlement.
- Settlement status.
- Basic reporting.
- Tests for financial calculations.
- Keep automated payouts as future scope.

## Stage 7 — Student Experience

- [ ] `/dashboard/student`
- [ ] `/dashboard/student/classes`
- [ ] `/dashboard/student/materials`
- [ ] `/dashboard/student/progress`

TODO:
- Next class.
- Meeting link.
- Materials.
- Attendance history.
- Basic progress.
- Empty/loading/error states.

## Stage 8 — Teacher Experience

- [ ] `/dashboard/teacher`
- [ ] `/dashboard/teacher/students`
- [ ] `/dashboard/teacher/classes`
- [ ] `/dashboard/teacher/materials`
- [ ] `/dashboard/teacher/earnings`

TODO:
- Assigned students.
- Upcoming classes.
- Class notes.
- Attendance.
- Material management.
- 85% earnings visibility.
- Prevent access to other teachers' students.

## Stage 9 — Production Hardening

- [ ] Public SEO pages finalized
- [ ] Sitemap
- [ ] Robots
- [ ] Structured data where justified
- [ ] Accessibility audit
- [ ] Security audit
- [ ] Error monitoring
- [ ] Backup/recovery
- [ ] Observability
- [ ] Production deployment

TODO:
- Core Web Vitals.
- WCAG 2.2 AA review.
- Auth/session security review.
- Authorization matrix review.
- Privacy review.
- Production environment checklist.

## Future — Explicitly Not MVP

- [ ] Native video classroom
- [ ] AI language tutor
- [ ] Gamification
- [ ] Internal messaging/chat
- [ ] Mobile app
- [ ] Public teacher marketplace
- [ ] Automated teacher payouts
- [ ] Advanced CRM
- [ ] Advanced certification
- [ ] Automated Zoom/Google Meet provisioning
- [ ] Advanced analytics
