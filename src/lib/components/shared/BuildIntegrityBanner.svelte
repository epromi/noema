<script lang="ts">
  let { message }: { message: string } = $props();
</script>

<div class="build-integrity-banner" role="alert">
  🚨 {message}
</div>

<style>
  .build-integrity-banner {
    background: color-mix(in srgb, var(--error) 18%, var(--card));
    border: 1px solid var(--error);
    color: var(--text);
    padding: 10px 14px;
    border-radius: 8px;
    margin-bottom: 12px;
    font-size: 0.92em;
    font-weight: 600;
  }
</style>
