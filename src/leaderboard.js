/**
 * 《奶娃之旅》实时速通排行榜模块
 * 支持：
 * 1. 本地毫秒级速通记录持久化 (localStorage)
 * 2. 同浏览器多标签页实时同步 (BroadcastChannel + storage event)
 * 3. 可选 Supabase 云端全球实时排行 (在 src/config.js 或页面内配置后自动启用定时拉取与实时提交)
 */
(function () {
  const STORAGE_RUNS_KEY = "naiwa_journey_runs_v1";
  const STORAGE_PLAYER_KEY = "naiwa_journey_player_v1";
  const STORAGE_CLOUD_KEY = "naiwa_journey_cloud_v1";

  const NPC_BENCHMARKS = [
    { id: "npc-1", name: "速通奶娃", timeMs: 31500, coins: 24, score: 12800, route: "密道捷径", isNpc: true, createdAt: "2026-11-18T00:00:00Z" },
    { id: "npc-2", name: "forgivez", timeMs: 46800, coins: 18, score: 9400, route: "常规通关", isNpc: true, createdAt: "2026-11-18T00:00:00Z" },
    { id: "npc-3", name: "散步奶娃", timeMs: 68250, coins: 12, score: 6200, route: "常规通关", isNpc: true, createdAt: "2026-11-18T00:00:00Z" }
  ];

  function formatTime(ms) {
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "--:--.---";
    const totalMs = Math.floor(ms);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = totalMs % 1000;
    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0") +
      "." +
      String(millis).padStart(3, "0")
    );
  }

  function normalizeSupabaseUrl(url) {
    return String(url || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/rest\/v1$/i, "")
      .replace(/\/+$/, "");
  }

  function buildSupabaseHeaders(key, extra = {}) {
    const cleanKey = String(key || "").trim();
    const headers = { apikey: cleanKey, ...extra };
    if (cleanKey.startsWith("eyJ")) {
      headers.Authorization = `Bearer ${cleanKey}`;
    }
    return headers;
  }

  class LeaderboardManager {
    constructor() {
      this.listeners = new Set();
      this.cloudRuns = [];
      this.cloudStatus = "local"; // 'local' | 'cloud-ok' | 'cloud-syncing' | 'cloud-err'
      this.cloudError = "";
      this.lastSyncAt = null;
      this.pollTimer = null;
      this.filterMode = "player"; // 默认仅展示真实玩家成绩；'all' 包含 NPC 基准

      this.channel = typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("naiwa_leaderboard_v1")
        : null;

      if (this.channel) {
        this.channel.onmessage = (ev) => {
          if (ev.data && ev.data.type === "NEW_RUN") {
            this._notify();
          }
        };
      }

      window.addEventListener("storage", (ev) => {
        if (ev.key === STORAGE_RUNS_KEY) {
          this._notify();
        }
      });

      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden && this.isCloudEnabled()) {
            this.syncCloudNow();
          }
        });
      }

      this._startCloudPolling();
    }

    getPlayerName() {
      const saved = localStorage.getItem(STORAGE_PLAYER_KEY);
      if (saved && saved.trim()) return saved.trim().slice(0, 16);
      return (window.NAIWA_CONFIG && window.NAIWA_CONFIG.DEFAULT_PLAYER_NAME) || "小奶娃";
    }

    setPlayerName(name) {
      const clean = (name || "").trim().slice(0, 16) || "小奶娃";
      localStorage.setItem(STORAGE_PLAYER_KEY, clean);
      this._notify();
      return clean;
    }

    getCloudConfig() {
      const base = (window.NAIWA_CONFIG && window.NAIWA_CONFIG.CLOUD_LEADERBOARD) || {};
      let override = {};
      try {
        override = JSON.parse(localStorage.getItem(STORAGE_CLOUD_KEY) || "{}");
      } catch (_) {}
      return {
        supabaseUrl: normalizeSupabaseUrl(override.supabaseUrl || base.supabaseUrl || ""),
        supabaseAnonKey: String(override.supabaseAnonKey || base.supabaseAnonKey || "").trim(),
        tableName: String(override.tableName || base.tableName || "naiwa_leaderboard").trim() || "naiwa_leaderboard",
        pollIntervalMs: base.pollIntervalMs || 10000
      };
    }

    setCloudConfig(supabaseUrl, supabaseAnonKey, tableName = "naiwa_leaderboard") {
      localStorage.setItem(
        STORAGE_CLOUD_KEY,
        JSON.stringify({
          supabaseUrl: normalizeSupabaseUrl(supabaseUrl),
          supabaseAnonKey: String(supabaseAnonKey || "").trim(),
          tableName: String(tableName || "naiwa_leaderboard").trim() || "naiwa_leaderboard"
        })
      );
      this.cloudRuns = [];
      this.cloudError = "";
      this._startCloudPolling();
      this._notify();
    }

    isCloudEnabled() {
      const cfg = this.getCloudConfig();
      return Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
    }

    getLocalRuns() {
      try {
        const raw = localStorage.getItem(STORAGE_RUNS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (_) {
        return [];
      }
    }

    saveLocalRun(run) {
      const runs = this.getLocalRuns();
      runs.push(run);
      // 保留最快的 100 条本地记录
      runs.sort((a, b) => a.timeMs - b.timeMs || b.score - a.score);
      localStorage.setItem(STORAGE_RUNS_KEY, JSON.stringify(runs.slice(0, 100)));
    }

    clearLocalRuns() {
      localStorage.removeItem(STORAGE_RUNS_KEY);
      if (this.channel) this.channel.postMessage({ type: "NEW_RUN" });
      this._notify();
    }

    async submitRun({ name, timeMs, coins, score, route }) {
      const cleanName = this.setPlayerName(name);
      const run = {
        id: "run-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        name: cleanName,
        timeMs: Math.round(timeMs),
        coins: coins || 0,
        score: score || 0,
        route: route || "常规通关",
        isNpc: false,
        createdAt: new Date().toISOString()
      };

      const prevBest = this.getPersonalBest(cleanName);
      this.saveLocalRun(run);

      if (this.channel) {
        this.channel.postMessage({ type: "NEW_RUN", run });
      }

      if (this.isCloudEnabled()) {
        await this._postCloudRun(run);
        await this.syncCloudNow();
      } else {
        this._notify();
      }

      const sorted = this.getRankedList("all");
      const rank = sorted.findIndex((r) => r.id === run.id) + 1;
      const isNewPb = !prevBest || run.timeMs < prevBest.timeMs;

      return { run, rank, isNewPb };
    }

    getPersonalBest(playerName = null) {
      const target = playerName || this.getPlayerName();
      const local = this.getLocalRuns().filter((r) => r.name === target);
      const cloud = this.cloudRuns.filter((r) => r.name === target);
      const all = [...local, ...cloud].sort((a, b) => a.timeMs - b.timeMs);
      return all[0] || null;
    }

    getRankedList(filterMode = this.filterMode) {
      const map = new Map();
      const addAll = (arr) => {
        arr.forEach((item) => {
          const key = item.id || `${item.name}-${item.timeMs}-${item.createdAt}`;
          if (!map.has(key)) map.set(key, item);
        });
      };

      if (filterMode === "all") {
        addAll(NPC_BENCHMARKS);
      }
      addAll(this.getLocalRuns());
      addAll(this.cloudRuns);

      const list = Array.from(map.values()).filter((item) =>
        filterMode === "player" ? !item.isNpc : true
      );

      list.sort((a, b) => a.timeMs - b.timeMs || (b.score || 0) - (a.score || 0));
      return list.slice(0, 30);
    }

    setFilterMode(mode) {
      this.filterMode = mode === "player" ? "player" : "all";
      this._notify();
    }

    subscribe(fn) {
      this.listeners.add(fn);
      fn(this.getSnapshot());
      return () => this.listeners.delete(fn);
    }

    getSnapshot() {
      return {
        runs: this.getRankedList(this.filterMode),
        filterMode: this.filterMode,
        playerName: this.getPlayerName(),
        personalBest: this.getPersonalBest(),
        cloudEnabled: this.isCloudEnabled(),
        cloudStatus: this.cloudStatus,
        cloudError: this.cloudError,
        lastSyncAt: this.lastSyncAt
      };
    }

    _notify() {
      const snap = this.getSnapshot();
      this.listeners.forEach((fn) => fn(snap));
    }

    _startCloudPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
      if (!this.isCloudEnabled()) {
        this.cloudStatus = "local";
        return;
      }
      const cfg = this.getCloudConfig();
      this.syncCloudNow();
      this.pollTimer = setInterval(() => {
        if (typeof document === "undefined" || !document.hidden) {
          this.syncCloudNow();
        }
      }, cfg.pollIntervalMs);
    }

    async syncCloudNow() {
      if (!this.isCloudEnabled()) return;
      const cfg = this.getCloudConfig();
      this.cloudStatus = "cloud-syncing";
      this._notify();

      try {
        const url = `${cfg.supabaseUrl}/rest/v1/${encodeURIComponent(cfg.tableName)}?select=id,name,time_ms,coins,score,route,created_at&order=time_ms.asc&limit=50`;
        const res = await fetch(url, {
          headers: buildSupabaseHeaders(cfg.supabaseAnonKey)
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${detail}`);
        }
        const rows = await res.json();
        this.cloudRuns = (Array.isArray(rows) ? rows : []).map((row) => ({
          id: "cloud-" + row.id,
          name: String(row.name || "匿名奶娃").slice(0, 16),
          timeMs: Number(row.time_ms),
          coins: Number(row.coins || 0),
          score: Number(row.score || 0),
          route: row.route || "常规通关",
          isNpc: false,
          isCloud: true,
          createdAt: row.created_at
        })).filter((r) => Number.isFinite(r.timeMs) && r.timeMs > 0);
        this.cloudStatus = "cloud-ok";
        this.cloudError = "";
        this.lastSyncAt = new Date();
      } catch (err) {
        console.warn("云端排行榜拉取失败:", err);
        this.cloudStatus = "cloud-err";
        this.cloudError = err && err.message ? err.message : "连接失败";
      }
      this._notify();
    }

    async _postCloudRun(run) {
      const cfg = this.getCloudConfig();
      try {
        const url = `${cfg.supabaseUrl}/rest/v1/${encodeURIComponent(cfg.tableName)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: buildSupabaseHeaders(cfg.supabaseAnonKey, {
            "Content-Type": "application/json",
            Prefer: "return=minimal"
          }),
          body: JSON.stringify({
            name: run.name,
            time_ms: run.timeMs,
            coins: run.coins,
            score: run.score,
            route: run.route
          })
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          console.warn("云端成绩上传失败:", res.status, detail);
        }
      } catch (err) {
        console.warn("云端成绩上传失败:", err);
      }
    }
  }

  window.Leaderboard = new LeaderboardManager();
  window.formatSpeedrunTime = formatTime;
})();
