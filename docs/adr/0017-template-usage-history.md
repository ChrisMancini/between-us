# Template Usage History

Recurring templates show no indication of whether or how often they've been used. When scanning the template list, there's no way to tell a stale template from an active one, or to remember when you last applied one. We decided to track usage directly on the template document and display it on the template card.

## Decisions

### 1. Store `lastAppliedAt` and `applyCount` on the template document

Usage stats are denormalized onto `RecurringTemplate` rather than derived from the activity log. The activity log records `recurring_apply` events, but it stores `templateName` as a string — renames would break the join, and per-template aggregation queries add unnecessary complexity for two simple counters. The apply route updates both fields atomically when a template is applied.

### 2. Backfill from the activity log via a one-time migration

A migration script aggregates existing `recurring_apply` activity entries by `metadata.templateName`, matches each group to the corresponding template by name, and sets `applyCount` and `lastAppliedAt`. This works because the dataset is small (two users) and no templates have been renamed since being applied. New templates default to `applyCount: 0` and `lastAppliedAt: null`.

### 3. Add `templateId` to activity log metadata going forward

The apply route will include the template's `_id` in the activity metadata alongside the existing `templateName`, `count`, and `date` fields. This makes future data resilient to template renames without affecting the activity feed display.

### 4. Display in the template card header

Usage stats appear as a muted secondary line in the `TemplateCard` header, below the existing "N items · $X.XX" summary. Format: "Last applied Jun 5 · 3 times" — year omitted for the current year, included otherwise, with proper "1 time" pluralization.

### 5. "Never applied" for unused templates

Templates with no usage history show "Never applied" in the same muted style, keeping card height consistent across the grid regardless of whether a template has been used.
