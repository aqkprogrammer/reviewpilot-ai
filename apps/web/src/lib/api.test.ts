import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, errorMessage, setActiveOrgId, subscribeServerWaking } from "./api";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("api client", () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    // The client de-duplicates concurrent refreshes and clears the shared promise on the next tick.
    await new Promise((r) => setTimeout(r, 5));
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "rp_csrf=csrf-token-123; path=/";
    setActiveOrgId("org-1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setActiveOrgId(null);
  });

  it("sends org header on reads and CSRF only on unsafe methods", async () => {
    fetchMock.mockImplementation(async () => json(200, { ok: true }));
    await api.get("/locations", { page: 2, empty: "", list: ["a", "b"] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/locations?page=2&list=a&list=b");
    expect(init.credentials).toBe("include");
    expect(init.headers["X-Organization-Id"]).toBe("org-1");
    expect(init.headers["X-CSRF-Token"]).toBeUndefined();

    await api.post("/campaigns", { name: "x" });
    const [, postInit] = fetchMock.mock.calls[1];
    expect(postInit.method).toBe("POST");
    expect(postInit.headers["X-CSRF-Token"]).toBe("csrf-token-123");
    expect(postInit.headers["Content-Type"]).toBe("application/json");
    expect(postInit.body).toBe(JSON.stringify({ name: "x" }));
  });

  it("omits org header when orgId is explicitly null", async () => {
    fetchMock.mockResolvedValue(json(200, {}));
    await api.get("/auth/me", undefined, { orgId: null });
    expect(fetchMock.mock.calls[0][1].headers["X-Organization-Id"]).toBeUndefined();
  });

  it("refreshes the session once on token_expired and retries", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "token_expired", message: "expired" } }))
      .mockResolvedValueOnce(json(200, { message: "refreshed" }))
      .mockResolvedValueOnce(json(200, { items: [1] }));
    const data = await api.get<{ items: number[] }>("/reviews");
    expect(data.items).toEqual([1]);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/auth/refresh");
    expect(fetchMock.mock.calls[1][1].headers["X-CSRF-Token"]).toBe("csrf-token-123");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws ApiError when refresh fails", async () => {
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: "token_expired", message: "expired" } }))
      .mockResolvedValueOnce(json(401, { error: { code: "session_invalid", message: "nope" } }))
      .mockResolvedValueOnce(json(401, { error: { code: "token_expired", message: "Session expired" } }));
    await expect(api.get("/reviews")).rejects.toMatchObject({ status: 401, code: "token_expired" });
  });

  it("maps error envelopes to ApiError", async () => {
    fetchMock.mockResolvedValue(json(402, { error: { code: "plan_limit_exceeded", message: "Upgrade to add more", details: { limit: 1 } } }));
    const err = (await api.post("/locations", {}).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("plan_limit_exceeded");
    expect(err.details).toEqual({ limit: 1 });
    expect(errorMessage(err)).toBe("Upgrade to add more");
  });

  it("returns undefined for 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.delete("/locations/1")).resolves.toBeUndefined();
  });

  describe("cold start", () => {
    const edge502 = () => new Response("<html><title>502</title></html>", { status: 502, headers: { "Content-Type": "text/html" } });

    afterEach(() => vi.useRealTimers());

    it("retries an edge 502 until the API wakes, and reports waking state", async () => {
      vi.useFakeTimers();
      const states: boolean[] = [];
      const unsub = subscribeServerWaking((w) => states.push(w));
      fetchMock.mockResolvedValueOnce(edge502()).mockResolvedValueOnce(edge502()).mockResolvedValueOnce(json(200, { ok: true }));
      const p = api.post<{ ok: boolean }>("/auth/login", { email: "a@b.co", password: "x" }, { orgId: null });
      await vi.advanceTimersByTimeAsync(10_000);
      await expect(p).resolves.toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(states).toEqual([true, false]);
      unsub();
    });

    it("does not retry a 503 that carries the API's own error envelope", async () => {
      fetchMock.mockResolvedValueOnce(json(503, { error: { code: "maintenance", message: "Down for maintenance" } }));
      await expect(api.get("/reviews")).rejects.toMatchObject({ status: 503, code: "maintenance" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("gives a friendly message when the server never wakes", async () => {
      vi.useFakeTimers();
      fetchMock.mockImplementation(async () => edge502());
      const p = api.get("/reviews");
      const assertion = expect(p).rejects.toThrow("still starting up");
      await vi.advanceTimersByTimeAsync(130_000);
      await assertion;
    });
  });
});

