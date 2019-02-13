export const enum InjectKey {
  MEASURE_CACHE = '@znck/virtualized/measure.cache',
  RESIZE_OBSERVER = '@znck/virtualized/measure.resize',
}

export const enum ScrollDirection {
  FORWARD = 1,
  REVERSE = -1,
}
export const enum ScrollTrigger {
  NONE = 0,
  OBSERVED,
  REQUESTED,
}
