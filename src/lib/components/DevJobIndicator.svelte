<script lang="ts">
  import { browser } from "$app/environment";
  import { onDestroy, onMount } from "svelte";
  import {
    DEFAULT_RELAY_URL,
    formatDevJobCountdown,
    getDevJobIndicatorState,
    getDevJobStatus,
  } from "$lib/core/noema-devjob";
  import type { DevJobStatus } from "$lib/types";

  const REFRESH_MS = 10_000;
  const COUNTDOWN_MS = 1_000;
  const STORAGE_KEY = "dli-pos";
  const DEFAULT_TOP = 80;
  const DEFAULT_RIGHT = 16;

  let status = $state<DevJobStatus>({
    nextMs: 0,
    queue: 0,
    running: null,
    updatedAt: 0,
  });
  let now = $state(Date.now());
  let posLeft = $state<number | null>(null);
  let posTop = $state<number | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);

  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartLeft = 0;
  let dragStartTop = 0;

  const countdown = $derived(
    formatDevJobCountdown(status.nextMs, !!status.error, now),
  );
  const indicatorState = $derived(getDevJobIndicatorState(status, now));

  let refreshTimer: ReturnType<typeof setInterval> | undefined;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;

  async function refresh() {
    status = await getDevJobStatus(DEFAULT_RELAY_URL);
  }

  function savePosition(left: number, top: number) {
    posLeft = left;
    posTop = top;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([left, top]));
    } catch {
      /* ignore quota / private mode */
    }
  }

  function clampPosition(left: number, top: number) {
    const panel = panelEl;
    if (!panel) return { left, top };

    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    return {
      left: Math.max(0, Math.min(left, window.innerWidth - width)),
      top: Math.max(0, Math.min(top, window.innerHeight - height)),
    };
  }

  function setPosition(left: number, top: number) {
    const clamped = clampPosition(left, top);
    savePosition(clamped.left, clamped.top);
  }

  function pointerClientXY(event: MouseEvent | TouchEvent) {
    if ("touches" in event && event.touches.length > 0) {
      return {
        x: event.touches[0]?.clientX ?? 0,
        y: event.touches[0]?.clientY ?? 0,
      };
    }
    const mouse = event as MouseEvent;
    return { x: mouse.clientX, y: mouse.clientY };
  }

  function onDragStart(event: MouseEvent | TouchEvent) {
    const panel = panelEl;
    if (!panel) return;

    dragging = true;
    const rect = panel.getBoundingClientRect();
    const { x, y } = pointerClientXY(event);
    dragStartX = x;
    dragStartY = y;
    dragStartLeft = rect.left;
    dragStartTop = rect.top;
    event.preventDefault();
  }

  function onDragMove(event: MouseEvent | TouchEvent) {
    if (!dragging) return;
    event.preventDefault();
    const { x, y } = pointerClientXY(event);
    setPosition(
      dragStartLeft + (x - dragStartX),
      dragStartTop + (y - dragStartY),
    );
  }

  function onDragEnd() {
    dragging = false;
  }

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const [left, top] = JSON.parse(raw) as [number, number];
        if (Number.isFinite(left) && Number.isFinite(top)) {
          posLeft = left;
          posTop = top;
        }
      }
    } catch {
      /* ignore invalid saved position */
    }

    void refresh();
    countdownTimer = setInterval(() => {
      now = Date.now();
    }, COUNTDOWN_MS);
    refreshTimer = setInterval(() => {
      void refresh();
    }, REFRESH_MS);

    document.addEventListener("mousemove", onDragMove);
    document.addEventListener("mouseup", onDragEnd);
    document.addEventListener("touchmove", onDragMove, { passive: false });
    document.addEventListener("touchend", onDragEnd);
  });

  onDestroy(() => {
    if (!browser) return;
    if (countdownTimer) clearInterval(countdownTimer);
    if (refreshTimer) clearInterval(refreshTimer);
    document.removeEventListener("mousemove", onDragMove);
    document.removeEventListener("mouseup", onDragEnd);
    document.removeEventListener("touchmove", onDragMove);
    document.removeEventListener("touchend", onDragEnd);
  });
</script>

<div
  bind:this={panelEl}
  class="dev-job-indicator"
  class:idle={indicatorState === "idle" || indicatorState === "offline"}
  class:soon={indicatorState === "soon"}
  class:active={indicatorState === "active"}
  style:left={posLeft !== null ? `${posLeft}px` : undefined}
  style:top={posTop !== null ? `${posTop}px` : `${DEFAULT_TOP}px`}
  style:right={posLeft !== null ? "auto" : `${DEFAULT_RIGHT}px`}
>
  <div class="dji-header">
    <span class="dji-title">⚙️ Dev Job</span>
    <button
      type="button"
      class="dji-grip"
      class:dragging
      aria-label="Húzd az indikátor pozíciójához"
      onmousedown={onDragStart}
      ontouchstart={onDragStart}
    >
      ⠿
    </button>
  </div>

  <div class="dji-row">
    <span class="dji-label">Következő:</span>
    <span
      class="dji-val dji-countdown"
      class:offline={!!status.error}
      class:soon={countdown.soon && !status.error}
      class:expired={countdown.expired}
    >
      {countdown.text}
    </span>
  </div>

  <div class="dji-row">
    <span class="dji-label">Sorban áll:</span>
    <span class="dji-val" class:queue-active={status.queue > 0}
      >{status.queue}</span
    >
  </div>

  {#if status.running}
    <div class="dji-row">
      <span class="dji-label">Fut:</span>
      <span class="dji-val running">{status.running}</span>
    </div>
  {/if}

  {#if status.error}
    <div class="dji-row dji-error">
      <span class="dji-label">⚠️ Hiba:</span>
      <span class="dji-val error-msg">{status.error}</span>
    </div>
  {/if}
</div>

<style>
  .dev-job-indicator {
    position: fixed;
    z-index: 9999;
    width: 220px;
    min-width: 200px;
    padding: 12px 14px;
    background: var(--card);
    border: 2px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    font-size: 0.82em;
    line-height: 1.5;
    user-select: none;
    transition: border-color 0.3s;
  }

  .dev-job-indicator.idle {
    border-color: var(--border);
  }

  .dev-job-indicator.soon {
    border-color: var(--yellow);
  }

  .dev-job-indicator.active {
    border-color: var(--green);
    animation: dji-pulse 2s infinite;
  }

  @keyframes dji-pulse {
    0%,
    100% {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    }
    50% {
      box-shadow: 0 0 24px rgba(63, 185, 80, 0.3);
    }
  }

  .dji-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }

  .dji-title {
    font-weight: 700;
    color: var(--accent);
    font-size: 0.85em;
  }

  .dji-grip {
    border: none;
    background: transparent;
    color: var(--muted);
    font-size: 1.1em;
    line-height: 1;
    padding: 2px 4px;
    cursor: grab;
    border-radius: 4px;
  }

  .dji-grip:hover {
    color: var(--text);
    background: rgba(255, 255, 255, 0.04);
  }

  .dji-grip.dragging,
  .dji-grip:active {
    cursor: grabbing;
  }

  .dji-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 2px;
  }

  .dji-label {
    color: var(--muted);
  }

  .dji-val {
    font-weight: 700;
    color: var(--muted);
  }

  .dji-countdown {
    font-size: 1.1em;
    font-family: "Fira Code", ui-monospace, monospace;
  }

  .dji-countdown.soon,
  .dji-countdown.expired {
    color: var(--yellow);
  }

  .dji-countdown.offline {
    color: var(--red);
    text-transform: lowercase;
  }

  .dji-val.queue-active {
    color: var(--yellow);
  }

  .dji-val.running {
    color: var(--green);
  }
</style>
