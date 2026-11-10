import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildPayload, CLIENT_ERRORS_ENDPOINT, MAX_REPORTS, reportError, resetErrorReporting } from "./report-error";

describe("reportError", () => {
  const beacon = vi.fn(() => true);

  beforeEach(() => {
    resetErrorReporting();
    beacon.mockClear();
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds a truncated payload with digest and path", () => {
    const err = Object.assign(new Error("boom"), { digest: "abc123" });
    err.stack = "x".repeat(10_000);
    const p = buildPayload(err);
    expect(p).toMatchObject({ message: "boom", name: "Error", digest: "abc123", path: window.location.pathname });
    expect(p.stack).toHaveLength(4000);
    expect(p.user_agent).toBeTruthy();
  });

  it("sends each distinct error once via sendBeacon", () => {
    expect(reportError(new Error("same"))).toBe(true);
    expect(reportError(new Error("same"))).toBe(false);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]).toEqual([CLIENT_ERRORS_ENDPOINT, expect.any(Blob)]);
  });

  it(`caps reports at ${MAX_REPORTS} per page load`, () => {
    for (let i = 0; i < MAX_REPORTS + 3; i++) reportError(new Error(`e${i}`));
    expect(beacon).toHaveBeenCalledTimes(MAX_REPORTS);
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true, writable: true });
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 202 })));
    vi.stubGlobal("fetch", fetchMock);
    expect(reportError("string failure")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(CLIENT_ERRORS_ENDPOINT, expect.objectContaining({ method: "POST", keepalive: true }));
    vi.unstubAllGlobals();
  });
});
