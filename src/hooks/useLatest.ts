import { useLayoutEffect, useRef, type MutableRefObject } from "react";

/** A ref holding the latest value, for callbacks that run later (e.g. after an undo window). */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
