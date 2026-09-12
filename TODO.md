# TODO — Academia

This is the executable project backlog. Keep it synchronized with `ROUTE-MAP.md` in every PR.

## Stage 0 — Foundation

### Objective
Understand and preserve the existing Next.js + Node.js system and establish the production-ready product foundation.

### TODO
- [ ] Audit repository structure.
- [ ] Audit current frontend/backend connection.
- [ ] Audit authentication.
- [ ] Audit roles already implemented.
- [ ] Audit DB/ORM/migrations.
- [ ] Audit existing UI/design system.
- [ ] Audit existing routes.
- [ ] Identify reusable components.
- [ ] Establish centralized Omegon visual tokens using existing project identity.
- [ ] Define environment variables and safe SuperAdmin bootstrap.
- [ ] Create/validate public/private route boundaries.
- [ ] Add base SEO metadata.
- [ ] Add accessibility baseline.
- [ ] Update route map with actual existing routes.

### Acceptance criteria
- Existing architecture is documented.
- No duplicate auth/API infrastructure was introduced.
- `omegon.info@gmail.com` can be provisioned as SuperAdmin through safe configuration.
- Route map reflects reality.
- Lint/typecheck/build baseline is known.

## Stage 1 — Identity, Roles & Permissions

### Objective
Make access control real and manageable.

### TODO
- [ ] Implement/verify SUPER_ADMIN.
- [ ] Implement DIRECTOR.
- [ ] Implement ADMINISTRATIVE.
- [ ] Implement TEACHER.
- [ ] Implement STUDENT.
- [ ] Director can assign Administrative permissions.
- [ ] Enforce permissions server-side.
- [ ] Add authorization tests.
- [ ] Add permission-change audit trail.

### Acceptance criteria
- Unauthorized API requests fail.
- UI does not expose inaccessible actions.
- Administrative users can only perform granted actions.
- Director controls Administrative permissions.
- SuperAdmin has technical access.

## Stage 2 — Students & Teachers

### Objective
Create the academy's people registry.

### TODO
- [ ] Student CRUD.
- [ ] Teacher CRUD.
- [ ] Level field.
- [ ] Active/inactive state.
- [ ] Basic profile.
- [ ] Teacher status/availability foundation.
- [ ] Access-control tests.

### Acceptance criteria
- Director/Admin with permission can manage records.
- Teachers cannot see unrelated private data.
- Students can only see their own private data.

## Stage 3 — Assignments & Academic Structure

### Objective
Model who teaches whom and which educational offering they belong to.

### TODO
- [ ] Student-teacher assignment.
- [ ] Assignment history.
- [ ] Prevent teacher self-assignment.
- [ ] 1:1 service: 60/90 minutes.
- [ ] Group service: max 15.
- [ ] Weekly group schedule foundation.
- [ ] Teacher-training course/group.
- [ ] Enrollment model.

### Acceptance criteria
- Director can assign a student to a teacher.
- Assignment is persisted and auditable.
- Teacher cannot create an assignment for themselves.
- Group cannot exceed 15 students.

## Stage 4 — Classes & Calendar

### Objective
Operate real live classes.

### TODO
- [ ] Class session CRUD.
- [ ] 60/90-minute 1:1 validation.
- [ ] 120-minute group validation.
- [ ] Recurrence.
- [ ] Meeting URL.
- [ ] Calendar.
- [ ] Conflict detection.
- [ ] Timezones.
- [ ] Attendance.
- [ ] Class notes.

### Acceptance criteria
- Teacher and student see the same scheduled class.
- Meeting link opens the configured external classroom.
- Attendance and notes persist.
- Invalid durations are rejected.

## Stage 5 — Materials

### Objective
Make class material available in context.

### TODO
- [ ] File upload.
- [ ] PDF/audio/image/link support.
- [ ] Attach to class/course.
- [ ] Access control.
- [ ] Teacher upload.
- [ ] Student download/view.
- [ ] Validation.

### Acceptance criteria
- Student sees only materials they are entitled to access.
- Teachers can manage permitted materials.
- Invalid uploads are rejected safely.

## Stage 6 — Finance

### Objective
Track the academy's 15% and teacher's 85%.

### TODO
- [ ] Student pricing.
- [ ] Payment record.
- [ ] Payment status.
- [ ] Academy share.
- [ ] Teacher share.
- [ ] Monthly/period settlement.
- [ ] Settlement status.
- [ ] Financial dashboard.
- [ ] Calculation tests.

### Acceptance criteria
For a $100 input:
- academy = $15
- teacher = $85

No floating-point/rounding bug may alter the intended settlement.

## Stage 7 — Student UX

### TODO
- [ ] Student dashboard.
- [ ] Next class.
- [ ] Calendar.
- [ ] Materials.
- [ ] Basic progress.
- [ ] Attendance history.
- [ ] Future features marked `Próximamente`.

## Stage 8 — Teacher UX

### TODO
- [ ] Teacher dashboard.
- [ ] Assigned students.
- [ ] Upcoming classes.
- [ ] Attendance.
- [ ] Notes.
- [ ] Materials.
- [ ] Earnings/settlement view.
- [ ] Future features marked `Próximamente`.

## Stage 9 — Production Hardening

### TODO
- [ ] SEO audit.
- [ ] WCAG 2.2 AA audit.
- [ ] Core Web Vitals.
- [ ] Security review.
- [ ] Authorization matrix test.
- [ ] Error monitoring.
- [ ] Backups.
- [ ] Recovery procedure.
- [ ] Production deployment checklist.
- [ ] Privacy/security documentation.

## Future backlog

These must remain visible in the roadmap but are not MVP:
- [ ] Native video.
- [ ] AI tutor.
- [ ] Gamification.
- [ ] Chat.
- [ ] Mobile app.
- [ ] Public teacher marketplace.
- [ ] Automated payouts.
- [ ] Advanced CRM.
- [ ] Advanced certification.
- [ ] Automated meeting provisioning.
- [ ] Advanced analytics.
