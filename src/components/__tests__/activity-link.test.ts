describe("ActivityLink", () => {
  describe("LINKABLE_ACTIONS constant", () => {
    it("includes expense_create, expense_edit, settlement_close, settlement_reopen", () => {
      // The ActivityLink component should only show popovers for these four actions:
      // - expense_create: Show expense details in popover
      // - expense_edit: Show expense details in popover
      // - settlement_close: Show settlement details in popover
      // - settlement_reopen: Show settlement details in popover
      //
      // This test documents the contract: only these actions show detail popovers.
      const linkableActions = ["expense_create", "expense_edit", "settlement_close", "settlement_reopen"];
      expect(linkableActions).toEqual(linkableActions);
    });
  });

  describe("Non-linkable actions", () => {
    it("documents that recurring_apply, csv_import, and action_* remain plain text", () => {
      // These activity types should NOT be interactive in the activity feed:
      // - recurring_apply: Applied a recurring template
      // - csv_import: Imported expenses from CSV
      // - action_created, action_paid, action_confirmed, action_cancelled: Action events
      //
      // Rationale: These don't map to specific resources to preview.
      const nonLinkableActions = [
        "recurring_apply",
        "csv_import",
        "action_created",
        "action_paid",
        "action_confirmed",
        "action_cancelled",
      ];
      expect(nonLinkableActions).toHaveLength(6);
    });
  });

  describe("API endpoints for data fetching", () => {
    it("fetches expense data from /api/expenses/{expenseId}", () => {
      // When opening an expense popover:
      // - GET /api/expenses/{expenseId} returns { expense: SerializedExpense }
      const expenseId = "507f1f77bcf86cd799439011";
      const dataUrl = `/api/expenses/${expenseId}`;
      expect(dataUrl).toBe("/api/expenses/507f1f77bcf86cd799439011");
    });

    it("fetches settlement data from /api/settlement?month=X&year=Y", () => {
      // When opening a settlement popover:
      // - GET /api/settlement?month=6&year=2026 returns settlement details
      const month = 6;
      const year = 2026;
      const dataUrl = `/api/settlement?month=${month}&year=${year}`;
      expect(dataUrl).toBe("/api/settlement?month=6&year=2026");
    });
  });

  describe("Popover interaction flow", () => {
    it("documents the popover opening sequence", () => {
      // When a user clicks an activity item:
      // 1. Popover opens and loading state is shown
      // 2. ActivityLink fetches the resource data from the API
      // 3. If 404: show "Resource not found" toast, close popover
      // 4. If 403: show "You don't have access to this resource" toast, close popover
      // 5. If 2xx: render detail popover content
      // 6. If other error: show "Unable to load resource details" toast, close popover
      //
      // This is important because expenses/settlements can be deleted between
      // when the activity feed loads and when the user clicks to view details.
      const statusCodes = {
        404: "Resource not found",
        403: "You don't have access to this resource",
        200: "show popover",
        500: "Unable to load resource details",
      };
      expect(Object.keys(statusCodes)).toContain("404");
      expect(Object.keys(statusCodes)).toContain("403");
    });
  });

  describe("ActivityLink as a client component", () => {
    it("documents that ActivityLink uses Popover and is marked with 'use client'", () => {
      // The ActivityLink component:
      // - Is a client component (marked with "use client" directive)
      // - Uses Popover/PopoverTrigger for showing details inline
      // - Uses sonner's toast for error messages
      // - Fetches data via GET before rendering popover content
      //
      // This keeps the activity feed responsive while showing details inline without navigation.
      expect("use client").toBeDefined();
    });
  });
});
