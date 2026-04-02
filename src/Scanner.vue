<template>
  <div class="scanner">
    <div class="scanner-header">
      <span class="tag-green">SCANNER</span>
      <span class="tag-purple">NOTA PROTOCOL</span>
      <button class="btn-ghost" @click="load" :disabled="loading">
        {{ loading ? '⟳ Loading...' : '⟳ Refresh' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-error">⚠ {{ error }}</div>

    <div v-if="loading && !messages.length" class="scanner-empty">
      Scanning blockchain...
    </div>

    <div v-else-if="!messages.length" class="scanner-empty">
      No messages found yet.
    </div>

    <div v-else class="messages">
      <div v-for="msg in messages" :key="msg.txid" class="message-row">
        <div class="message-meta">
          <span class="message-block">
            {{ msg.height ? '#' + msg.height : 'unconfirmed' }}
          </span>
          <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
          <a
            :href="`https://bchexplorer.cash/tx/${msg.txid}`"
            target="_blank" rel="noreferrer"
            class="message-txid"
          >{{ msg.txid.slice(0, 10) }}...↗</a>
        </div>
        <div class="message-text">{{ msg.message }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { fetchMessages } from './scanner.js'

const messages = ref([])
const loading  = ref(false)
const error    = ref(null)

async function load() {
  loading.value = true
  error.value   = null
  try {
    messages.value = await fetchMessages(50)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function formatTime(ts) {
  if (!ts) return '-';

  const timestamp = Number(ts) * 1000; // Convert seconds to milliseconds

  // Check if the conversion resulted in a valid number
  if (isNaN(timestamp)) {
    return '-'; // Return '-' for invalid timestamps
  }

  const date = new Date(timestamp);

  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return '-'; // Return '-' for invalid date objects
  }

  return date.toLocaleString();
}

onMounted(load)
</script>

<style scoped>
.scanner {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}
.scanner-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.scanner-empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--text-dim);
  font-family: var(--mono);
  font-size: 13px;
}
.messages {
  display: flex;
  flex-direction: column;
}
.message-row {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.message-row:last-child { border-bottom: none; }
.message-row:hover { background: var(--surface2); }
.message-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.message-block {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--accent);
}
.message-time {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dimmer);
}
.message-txid {
  font-family: var(--mono);
  font-size: 11px;
  color: var(--text-dim);
  text-decoration: none;
}
.message-txid:hover { color: var(--accent2); }
.message-text {
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}
</style>