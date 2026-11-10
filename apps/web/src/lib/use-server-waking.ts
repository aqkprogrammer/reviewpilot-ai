"use client";
import * as React from "react";
import { subscribeServerWaking, warmUpApi } from "./api";

/**
 * True while an API request is waiting for a sleeping backend to boot.
 * Pass `warmUp` to ping the API on mount so it starts booting before the user submits.
 */
export function useServerWaking({ warmUp = false }: { warmUp?: boolean } = {}) {
  const [waking, setWaking] = React.useState(false);
  React.useEffect(() => subscribeServerWaking(setWaking), []);
  React.useEffect(() => {
    if (warmUp) warmUpApi();
  }, [warmUp]);
  return waking;
}
