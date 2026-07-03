# Bulk expense deletion follows bulk edit patterns

Bulk delete reuses the same UI flow, API structure, and validation patterns established by bulk edit (ADR-0010) rather than introducing new patterns. The `DELETE /api/expenses/bulk` endpoint lives alongside the existing `PATCH` handler, shared validation logic (ID validation, expense fetching, settled-month checking, readiness reset) is extracted into helpers used by both, and the confirmation dialog uses the same two-phase flow (confirming → results). This keeps the bulk-action experience consistent for users and avoids duplicating route-level logic.

## Considered options

- **Separate route and independent UI flow**: Would allow delete-specific UX but introduces redundant validation code and a second mental model for bulk actions.
- **Reuse `DeleteDialog` with a count**: Simpler, but loses the skip-reason feedback (settled months, unowned expenses) that users need before committing to a destructive action.
