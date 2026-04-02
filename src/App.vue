<template>
  <div class="app">
    <!-- HEADER -->
    <header class="header">
      <div class="logo">
        <div class="logo-icon">⬡</div>
        <div>
          <div class="logo-title">OP_RETURN</div>
          <div class="logo-sub">NOTA PROTOCOL</div>
        </div>
      </div>

      <div class="header-right">
        <template v-if="address">
          <div class="wallet-badge">
            <span class="dot" />
            <span class="wallet-addr">{{ truncate(address) }}</span>
          </div>
          <button class="btn-danger" @click="disconnect">Disconnect</button>
        </template>
        <button v-else class="btn-primary" :disabled="connecting" @click="connect">
          <span v-if="connecting" class="spinner" />
          {{ connecting ? 'Connecting...' : '⬡ Connect Wallet' }}
        </button>
      </div>
    </header>

    <!-- MAIN -->
    <main class="main">
      <!-- HERO -->
      <div class="hero">
        <h1>Write to the <span class="accent">blockchain</span></h1>
        <p class="hero-sub">
          NOTA PROTOCOL<br>
          Broadcast any message permanently on Bitcoin Cash<br>
          Immutable. Permissionless. Forever.
        </p>
      </div>

      <!-- WC ERROR -->
      <div v-if="wcError" class="alert alert-error">⚠ {{ wcError }}</div>

      <!-- CONNECT PROMPT -->
      <div v-if="!address" class="connect-prompt">
        <div class="prompt-icon">🔗</div>
        <h3>Connect your BCH wallet</h3>
        <p>
          Use any BCH WalletConnect-compatible wallet - like
          <a href="https://cashonize.com" target="_blank" rel="noreferrer">Cashonize</a>.
        </p>
        <button class="btn-primary btn-lg" :disabled="connecting" @click="connect">
          <span v-if="connecting" class="spinner" />
          {{ connecting ? 'Connecting...' : '⬡ Connect Wallet' }}
        </button>
      </div>

      <!-- COMPOSE PANEL -->
      <div class="panel" :class="{ disabled: !address }">
        <!-- panel header -->
        <div class="panel-header">
          <div class="panel-title-row">
            <span class="tag-green">OP_RETURN</span>
            <span class="tag-purple">MAINNET</span>
          </div>
          <button class="btn-ghost" @click="showAdvanced = !showAdvanced">
            {{ showAdvanced ? '▲' : '▼' }} Advanced
          </button>
        </div>

        <!-- advanced -->
        <div v-if="showAdvanced" class="advanced">
          <label class="field-label">PROTOCOL PREFIX (HEX)</label>
          <input
            v-model="prefix"
            class="input"
            placeholder="0x4e4f5441"
            readonly
          />
          <p class="field-hint">Default: 0x4e4f5441 = "NOTA"</p>
        </div>

        <!-- message -->
        <div class="field">
          <div class="field-row">
            <label class="field-label">MESSAGE</label>
            <span class="byte-counter" :class="byteClass">
              {{ msgBytes }} / {{ MAX_BYTES }} bytes
            </span>
          </div>
          <textarea
            v-model="message"
            class="textarea"
            :class="{ 'input-error': overLimit }"
            rows="5"
            :disabled="isProcessing"
            placeholder="Enter your message to broadcast on-chain..."
          />
          <p v-if="overLimit" class="field-error">
            Message is {{ -bytesLeft }} bytes over the limit
          </p>
        </div>

        <!-- send button -->
        <div class="panel-footer">
          <button
            class="btn-send"
            :class="{ active: canSend }"
            :disabled="!canSend"
            @click="handleSend"
          >
            <span v-if="isProcessing" class="spinner spinner-dark" />
            <template v-if="status === 'building'">Building transaction...</template>
            <template v-else-if="status === 'signing'">Waiting for wallet...</template>
            <template v-else>Broadcast to BCH →</template>
          </button>
        </div>
      </div>

      <!-- SUCCESS -->
      <div v-if="status === 'success' && txHash" class="result result-success">
        <div class="result-title">✅ Message broadcast successfully!</div>
        <div class="result-label">TRANSACTION ID</div>
        <div class="result-hash">{{ txHash }}</div>
        <div class="result-links">
          <a :href="`https://bchexplorer.cash/tx/${txHash}`" target="_blank" rel="noreferrer" class="link-green">
            BCH Explorer ↗
          </a>
          <a :href="`https://explorer.bch.ninja/tx/${txHash}`" target="_blank" rel="noreferrer" class="link-purple">
            BCH Ninja Explorer ↗
          </a>
        </div>
      </div>

      <!-- ERROR -->
      <div v-if="status === 'error' && txError" class="result result-error">
        <div class="result-title">⚠ Transaction failed</div>
        <div class="result-msg">{{ txError }}</div>
      </div>

      <!-- INFO CARDS -->
      <div class="cards">
        <div class="card" v-for="c in cards" :key="c.label">
          <div class="card-icon">{{ c.icon }}</div>
          <div class="card-label">{{ c.label }}</div>
          <div class="card-desc">{{ c.desc }}</div>
        </div>
      </div>

      <!-- SCANNER -->
      <OpReturnScanner />
    </main>

    <!-- FOOTER -->
    <footer class="footer">
      <span class="footer-text">Built with CashScript + Reown AppKit</span>
      <div class="footer-links">
        <a href="https://cashscript.org" target="_blank" rel="noreferrer">CashScript ↗</a>
        <a href="https://dashboard.reown.com" target="_blank" rel="noreferrer">Reown ↗</a>
        <a href="https://tokenaut.cash/dapps?filter=walletconnect" target="_blank" rel="noreferrer">WC Dapps ↗</a>
        <a href="https://github.com/mazetoken/notaprotocol" target="_blank" rel="noreferrer">Github ↗</a>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWalletConnect } from './useWalletConnect.js'
import { buildOpReturnTransaction } from './transaction.js'
import OpReturnScanner from './Scanner.vue'

const MAX_BYTES = 220

const { address, connecting, error: wcError, init, connect, disconnect, signTransaction } = useWalletConnect()

const message      = ref('')
const prefix       = ref('0x4e4f5441')
const showAdvanced = ref(false)
const status       = ref(null)   // null | 'building' | 'signing' | 'success' | 'error'
const txHash       = ref(null)
const txError      = ref(null)

onMounted(() => init())

const msgBytes  = computed(() => new TextEncoder().encode(message.value).length)
const bytesLeft = computed(() => MAX_BYTES - msgBytes.value)
const overLimit = computed(() => bytesLeft.value < 0)
const byteClass = computed(() => {
  if (overLimit.value)        return 'byte-red'
  if (bytesLeft.value < 30)   return 'byte-yellow'
  return 'byte-dim'
})

const isProcessing = computed(() => status.value === 'building' || status.value === 'signing')
const canSend      = computed(() =>
  !!address.value && !!message.value.trim() && !overLimit.value && !isProcessing.value
)

function truncate(addr) {
  if (!addr) return ''
  const core = addr.startsWith('bitcoincash:') ? addr.slice(12) : addr
  const pfx  = addr.startsWith('bitcoincash:') ? 'bitcoincash:' : ''
  return pfx + core.slice(0, 6) + '...' + core.slice(-6)
}

async function handleSend() {
  if (!canSend.value) return
  txHash.value  = null
  txError.value = null
  status.value  = 'building'
  try {
    const { wcTransactionObj } = await buildOpReturnTransaction({
      address: address.value,
      message: message.value.trim(),
      protocolPrefix: prefix.value,
    })
    status.value = 'signing'
    const result = await signTransaction(wcTransactionObj)
    if (result?.signedTransactionHash) {
      txHash.value  = result.signedTransactionHash
      status.value  = 'success'
      message.value = ''
    } else {
      throw new Error('Wallet returned no transaction hash.')
    }
  } catch (e) {
    txError.value = e.message || 'Transaction failed'
    status.value  = 'error'
  }
}

const cards = [
  { icon: '∞', label: 'Permanent',      desc: 'Stored in every BCH full node forever' },
  { icon: '⛓', label: 'On-chain',       desc: 'Real blockchain data, not a database' },
  { icon: '🔓', label: 'Permissionless', desc: 'No accounts, no censorship' },
]
</script>

<style scoped>
/* ── Layout ─────────────────────────────────────────────── */
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Header ─────────────────────────────────────────────── */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: rgba(14,14,24,0.94);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(12px);
}
.logo { display: flex; align-items: center; gap: 12px; }
.logo-icon {
  width: 34px; height: 34px;
  background: var(--accent);
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  box-shadow: 0 0 18px rgba(0,229,160,0.35);
}
.logo-title { font-weight: 800; font-size: 15px; letter-spacing: 1px; }
.logo-sub   { font-family: var(--mono); font-size: 9px; color: var(--text-dim); letter-spacing: 3px; }

.header-right { display: flex; align-items: center; gap: 10px; }

.wallet-badge {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: var(--accent-dim);
  border: 1px solid rgba(0,229,160,0.22);
  border-radius: 8px;
}
.dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  animation: glow 2s infinite;
  flex-shrink: 0;
}
.wallet-addr { font-family: var(--mono); font-size: 11px; color: var(--accent); }

/* ── Buttons ─────────────────────────────────────────────── */
.btn-primary {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 18px;
  background: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: #08080f;
  font-size: 13px; font-weight: 700;
  transition: all 0.15s;
}
.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(0,229,160,0.35);
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-lg { padding: 12px 32px; font-size: 14px; }

.btn-danger {
  padding: 6px 12px;
  background: var(--red-dim);
  border: 1px solid rgba(255,87,87,0.25);
  border-radius: 8px;
  color: var(--red);
  font-size: 12px; font-weight: 600;
  transition: all 0.15s;
}
.btn-danger:hover { background: rgba(255,87,87,0.18); }

.btn-ghost {
  background: none; border: none;
  color: var(--text-dim);
  font-size: 12px;
  padding: 4px 8px;
  transition: color 0.15s;
}
.btn-ghost:hover { color: var(--text); }

/* ── Spinner ─────────────────────────────────────────────── */
.spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(8,8,15,0.3);
  border-top-color: #08080f;
  animation: spin 0.8s linear infinite;
}
.spinner-dark {
  border-color: rgba(0,229,160,0.3);
  border-top-color: var(--accent);
}

/* ── Main ────────────────────────────────────────────────── */
.main {
  flex: 1;
  max-width: 680px;
  width: 100%;
  margin: 0 auto;
  padding: 48px 24px 64px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Hero ────────────────────────────────────────────────── */
.hero { text-align: center; padding-bottom: 12px; animation: fadeUp 0.5s ease; }
.hero h1 {
  font-size: clamp(30px, 6vw, 52px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -1px;
  margin-bottom: 12px;
}
.accent { color: var(--accent); text-shadow: 0 0 40px rgba(0,229,160,0.4); }
.hero-sub {
  color: var(--text-dim);
  font-size: 15px;
  max-width: 420px;
  margin: 0 auto;
  line-height: 1.65;
}

/* ── Alert ───────────────────────────────────────────────── */
.alert { padding: 12px 16px; border-radius: 10px; font-family: var(--mono); font-size: 12px; }
.alert-error { background: rgba(255,87,87,0.08); border: 1px solid rgba(255,87,87,0.28); color: var(--red); }

/* ── Connect Prompt ──────────────────────────────────────── */
.connect-prompt {
  text-align: center;
  border: 1px dashed var(--border-hi);
  border-radius: 16px;
  padding: 40px 24px;
  animation: fadeUp 0.4s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.prompt-icon { font-size: 42px; }
.connect-prompt h3 { font-weight: 700; font-size: 18px; }
.connect-prompt p  { color: var(--text-dim); font-size: 13px; line-height: 1.6; }
.connect-prompt a  { color: var(--accent); text-decoration: none; }
.connect-prompt a:hover { text-decoration: underline; }

/* ── Panel ───────────────────────────────────────────────── */
.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  transition: opacity 0.3s;
  animation: fadeUp 0.5s ease 0.15s both;
}
.panel.disabled { opacity: 0.35; pointer-events: none; }

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.panel-title-row { display: flex; align-items: center; gap: 8px; }

.tag-green {
  font-family: var(--mono); font-size: 11px; letter-spacing: 2px;
  color: var(--accent);
}
.tag-purple {
  padding: 2px 8px;
  background: rgba(124,106,247,0.12);
  border: 1px solid rgba(124,106,247,0.28);
  border-radius: 4px;
  font-family: var(--mono); font-size: 10px;
  color: var(--accent2);
}

/* Advanced block */
.advanced {
  padding: 16px 20px;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  animation: fadeUp 0.2s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Fields */
.field { padding: 20px 20px 0; }
.field-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
.field-label { font-family: var(--mono); font-size: 11px; color: var(--text-dim); letter-spacing: 1px; }
.field-hint  { font-family: var(--mono); font-size: 11px; color: var(--text-dimmer); margin-top: 4px; }
.field-error { font-family: var(--mono); font-size: 11px; color: var(--red); margin-top: 6px; }

.byte-counter { font-family: var(--mono); font-size: 11px; }
.byte-dim    { color: var(--text-dimmer); }
.byte-yellow { color: var(--accent3); }
.byte-red    { color: var(--red); }

.input, .textarea {
  width: 100%;
  padding: 11px 13px;
  background: var(--surface2);
  border: 1px solid var(--border-hi);
  border-radius: 9px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}
.textarea { resize: vertical; line-height: 1.6; font-size: 14px; }
.input:focus, .textarea:focus { border-color: var(--accent); }
.input-error { border-color: var(--red) !important; }

/* Send button */
.panel-footer { padding: 16px 20px 20px; }
.btn-send {
  width: 100%;
  padding: 14px;
  background: rgba(0,229,160,0.06);
  border: 1px solid rgba(0,229,160,0.15);
  border-radius: 10px;
  color: rgba(0,229,160,0.35);
  font-size: 14px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 10px;
  cursor: not-allowed;
  transition: all 0.15s;
}
.btn-send.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #08080f;
  cursor: pointer;
  box-shadow: 0 0 20px rgba(0,229,160,0.2);
}
.btn-send.active:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 28px rgba(0,229,160,0.35);
}

/* ── Results ─────────────────────────────────────────────── */
.result {
  padding: 20px;
  border-radius: 12px;
  animation: fadeUp 0.35s ease;
}
.result-success { background: rgba(0,229,160,0.05); border: 1px solid rgba(0,229,160,0.22); }
.result-error   { background: var(--red-dim); border: 1px solid rgba(255,87,87,0.22); }

.result-title { font-weight: 700; font-size: 15px; margin-bottom: 12px; }
.result-success .result-title { color: var(--accent); }
.result-error   .result-title { color: var(--red); }

.result-label { font-family: var(--mono); font-size: 11px; color: var(--text-dim); letter-spacing: 1px; margin-bottom: 6px; }
.result-hash  { font-family: var(--mono); font-size: 12px; line-height: 1.5; word-break: break-all; margin-bottom: 14px; }
.result-msg   { font-family: var(--mono); font-size: 12px; color: var(--text-dim); line-height: 1.5; }

.result-links { display: flex; gap: 10px; flex-wrap: wrap; }
.link-green, .link-purple {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12px; font-weight: 600;
  text-decoration: none;
  transition: opacity 0.15s;
}
.link-green  { background: var(--accent-dim); border: 1px solid rgba(0,229,160,0.28); color: var(--accent); }
.link-purple { background: rgba(124,106,247,0.1); border: 1px solid rgba(124,106,247,0.28); color: var(--accent2); }
.link-green:hover, .link-purple:hover { opacity: 0.8; }

/* ── Info Cards ──────────────────────────────────────────── */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
  gap: 12px;
  margin-top: 12px;
  animation: fadeUp 0.5s ease 0.25s both;
}
.card {
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  transition: border-color 0.15s;
}
.card:hover { border-color: var(--border-hi); }
.card-icon  { font-size: 22px; margin-bottom: 8px; }
.card-label { font-weight: 700; font-size: 13px; margin-bottom: 4px; }
.card-desc  { font-size: 12px; color: var(--text-dim); line-height: 1.55; }

/* ── Footer ──────────────────────────────────────────────── */
.footer {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 8px;
  padding: 18px 24px;
  border-top: 1px solid var(--border);
}
.footer-text  { font-family: var(--mono); font-size: 11px; color: var(--text-dimmer); }
.footer-links { display: flex; gap: 16px; }
.footer-links a {
  font-family: var(--mono); font-size: 11px; color: var(--text-dimmer);
  text-decoration: none; transition: color 0.15s;
}
.footer-links a:hover { color: var(--text-dim); }
</style>