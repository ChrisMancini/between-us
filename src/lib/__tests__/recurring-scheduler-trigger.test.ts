import { asMock } from "@/test/api-helpers";

jest.mock("@/lib/recurring-runner", () => ({ runScheduler: jest.fn() }));

import { runScheduler } from "@/lib/recurring-runner";
import { startRecurringScheduler } from "@/lib/recurring-scheduler-trigger";

const globalForScheduler = globalThis as typeof globalThis & {
  __recurringSchedulerTimer?: ReturnType<typeof setInterval>;
};

const HOUR = 60 * 60 * 1000;

const ORIGINAL_RUNTIME = process.env.NEXT_RUNTIME;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setEnv(nextRuntime: string | undefined, nodeEnv: string) {
  if (nextRuntime === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = nextRuntime;
  // NODE_ENV is readonly in the Node types; assign through a cast.
  (process.env as { NODE_ENV?: string }).NODE_ENV = nodeEnv;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  asMock(runScheduler).mockResolvedValue({
    templatesProcessed: 0,
    occurrencesApplied: 0,
    occurrencesSkipped: 0,
    expensesCreated: 0,
    alertsRaised: 0,
  });
  // Disarm any timer a prior test left in the shared process global.
  if (globalForScheduler.__recurringSchedulerTimer) {
    clearInterval(globalForScheduler.__recurringSchedulerTimer);
    delete globalForScheduler.__recurringSchedulerTimer;
  }
});

afterEach(() => {
  if (globalForScheduler.__recurringSchedulerTimer) {
    clearInterval(globalForScheduler.__recurringSchedulerTimer);
    delete globalForScheduler.__recurringSchedulerTimer;
  }
  jest.useRealTimers();
});

afterAll(() => {
  setEnv(ORIGINAL_RUNTIME, ORIGINAL_NODE_ENV ?? "test");
});

describe("startRecurringScheduler gating", () => {
  it("does not arm outside the Node.js runtime (e.g. Edge)", () => {
    setEnv("edge", "production");
    expect(startRecurringScheduler()).toBe(false);
    expect(globalForScheduler.__recurringSchedulerTimer).toBeUndefined();
    expect(runScheduler).not.toHaveBeenCalled();
  });

  it("does not arm when NEXT_RUNTIME is unset", () => {
    setEnv(undefined, "production");
    expect(startRecurringScheduler()).toBe(false);
    expect(runScheduler).not.toHaveBeenCalled();
  });

  it("does not arm in development", () => {
    setEnv("nodejs", "development");
    expect(startRecurringScheduler()).toBe(false);
    expect(globalForScheduler.__recurringSchedulerTimer).toBeUndefined();
    expect(runScheduler).not.toHaveBeenCalled();
  });

  it("arms and runs a startup catch-up in production on Node.js", () => {
    setEnv("nodejs", "production");
    expect(startRecurringScheduler()).toBe(true);
    expect(globalForScheduler.__recurringSchedulerTimer).toBeDefined();
    // Startup catch-up fires immediately.
    expect(runScheduler).toHaveBeenCalledTimes(1);
  });
});

describe("startRecurringScheduler timer", () => {
  beforeEach(() => setEnv("nodejs", "production"));

  it("invokes the runner again on the hourly interval", () => {
    startRecurringScheduler();
    expect(runScheduler).toHaveBeenCalledTimes(1); // startup

    jest.advanceTimersByTime(HOUR);
    expect(runScheduler).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(HOUR);
    expect(runScheduler).toHaveBeenCalledTimes(3);
  });

  it("does not stack a second timer when called again in the same process", () => {
    expect(startRecurringScheduler()).toBe(true);
    expect(startRecurringScheduler()).toBe(false); // already armed
    expect(runScheduler).toHaveBeenCalledTimes(1); // only the first startup run

    jest.advanceTimersByTime(HOUR);
    // A single timer fired, not two.
    expect(runScheduler).toHaveBeenCalledTimes(2);
  });

  it("keeps the timer alive after a failed run", async () => {
    asMock(runScheduler).mockRejectedValueOnce(new Error("db blip"));
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    startRecurringScheduler();
    // Let the rejected startup run settle without unhandled-rejection noise.
    await Promise.resolve();

    jest.advanceTimersByTime(HOUR);
    expect(runScheduler).toHaveBeenCalledTimes(2); // timer survived the failure

    errorSpy.mockRestore();
  });
});
