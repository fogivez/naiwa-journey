/**
 * 《奶娃之旅》页面控制与实时排行榜界面绑定
 * 作者: forgivez
 */
(function () {
  const CFG = window.NAIWA_CONFIG;
  const LB = window.Leaderboard;
  const Audio = window.RetroAudio;
  const fmt = window.formatSpeedrunTime;

  const canvas = document.getElementById("game-canvas");
  const pauseOverlay = document.getElementById("pause-overlay");

  // HUD 元素
  const hudHero = document.getElementById("hud-hero");
  const hudCoins = document.getElementById("hud-coins");
  const hudScore = document.getElementById("hud-score");
  const hudTimer = document.getElementById("hud-timer");
  const hudPb = document.getElementById("hud-pb");
  const headerPlayerName = document.getElementById("header-player-name");

  const STAGE_INFO = window.NaiwaLevels.STAGE_INFO;
  const headerStageSub = document.getElementById("header-stage-sub");
  const stageButtons = Array.from(document.querySelectorAll(".stage-pill[data-stage]"));

  // NPC 对话框元素 (无配音)
  const npcTalkBtn = document.getElementById("npc-talk-btn");
  const dialogueBox = document.getElementById("dialogue-box");
  const dialoguePortrait = document.getElementById("dialogue-portrait");
  const dialogueSpeaker = document.getElementById("dialogue-speaker");
  const dialogueText = document.getElementById("dialogue-text");
  const dialogueNext = document.getElementById("dialogue-next");

  // 过关剧情转场弹窗 (1~3 关)
  const stageClearModal = document.getElementById("stage-clear-modal");
  const stageClearTitle = document.getElementById("stage-clear-title");
  const stageClearStory = document.getElementById("stage-clear-story");
  const stageClearTime = document.getElementById("stage-clear-time");
  const stageClearScore = document.getElementById("stage-clear-score");
  const nextStageBtn = document.getElementById("next-stage-btn");
  const submitStage1Btn = document.getElementById("submit-stage1-btn");
  const stageRetryBtn = document.getElementById("stage-retry-btn");

  // 启动欢迎弹窗与关于作者弹窗
  const welcomeModal = document.getElementById("welcome-modal");
  const playerInput = document.getElementById("player-name-input");
  const startGameBtn = document.getElementById("start-game-btn");
  const authorModal = document.getElementById("author-modal");
  const openAuthorBtn = document.getElementById("open-author-btn");
  const closeAuthorBtn = document.getElementById("close-author-btn");

  // 胜利弹窗
  const victoryModal = document.getElementById("victory-modal");
  const victoryTitle = document.getElementById("victory-title");
  const victoryTime = document.getElementById("victory-time");
  const victoryRank = document.getElementById("victory-rank");
  const victoryScore = document.getElementById("victory-score");
  const victoryRoute = document.getElementById("victory-route");
  const victoryPbBanner = document.getElementById("victory-pb-banner");
  const victoryRetryBtn = document.getElementById("victory-retry-btn");
  const victoryCloseBtn = document.getElementById("victory-close-btn");

  // 排行榜元素
  const lbList = document.getElementById("lb-list");
  const lbLiveText = document.getElementById("lb-live-text");
  const tabAllBtn = document.getElementById("lb-tab-all");
  const tabPlayerBtn = document.getElementById("lb-tab-player");
  const clearRunsBtn = document.getElementById("lb-clear-btn");

  // 云端设置弹窗
  const cloudModal = document.getElementById("cloud-modal");
  const openCloudBtn = document.getElementById("open-cloud-btn");
  const cloudUrlInput = document.getElementById("cloud-url-input");
  const cloudKeyInput = document.getElementById("cloud-key-input");
  const cloudTableInput = document.getElementById("cloud-table-input");
  const saveCloudBtn = document.getElementById("save-cloud-btn");
  const cancelCloudBtn = document.getElementById("cancel-cloud-btn");

  // 控制按钮
  const muteBtn = document.getElementById("mute-btn");
  const restartBtn = document.getElementById("restart-btn");
  const pauseBtn = document.getElementById("pause-btn");

  // 初始化作者头像与奶娃头像
  document.getElementById("author-avatar-img").src = CFG.authorAvatarPath;
  document.getElementById("naiwa-portrait-img").src = CFG.naiwaPortraitPath;

  playerInput.value = LB.getPlayerName();
  headerPlayerName.textContent = LB.getPlayerName();

  let lastHighlightRunId = null;
  let pendingStageResult = null;

  const STAGE_TRANSITION_STORY = {
    1: "你穿过青草村的城堡大门，顺着石阶走进了幽暗潮湿的古代地下矿道……前方是第 2 关「1-2 幽暗古矿洞」！",
    2: "走出幽暗矿洞，暮色云海之上悬浮着巨大的树冠天桥！前方是第 3 关「1-3 迷雾天桥群岛」！",
    3: "跨越天桥群岛，炽热的岩浆气息迎面扑来！深渊红龙就在里面，准备决战第 4 关「1-4 恶龙熔岩城堡」！"
  };

  function updateStageUi(stageNum) {
    const info = STAGE_INFO[stageNum] || STAGE_INFO[1];
    if (headerStageSub) {
      headerStageSub.textContent = `当前关卡：${info.code} ${info.name} · 勇者奶娃斗恶龙篇`;
    }
    stageButtons.forEach((btn) => {
      btn.classList.toggle("active", Number(btn.getAttribute("data-stage")) === stageNum);
    });
  }

  async function submitAndShowVictory(result, titleText) {
    const playerName = LB.setPlayerName(playerInput.value);
    headerPlayerName.textContent = playerName;

    const { run, rank, isNewPb } = await LB.submitRun({
      name: playerName,
      timeMs: result.timeMs,
      coins: result.coins,
      score: result.score,
      route: result.route
    });

    lastHighlightRunId = run.id;
    victoryTitle.textContent = titleText;
    victoryTime.textContent = fmt(result.timeMs);
    victoryRank.textContent = rank > 0 ? `第 ${rank} 名` : "已上榜";
    victoryScore.textContent = `${result.score} 分 / ${result.coins} 币`;
    victoryRoute.textContent = result.route;
    victoryPbBanner.classList.toggle("hidden", !isNewPb);

    game.modalOpen = true;
    victoryModal.classList.remove("hidden");
  }

  const game = new window.NaiwaGame(canvas, {
    onHudUpdate: (hud) => {
      hudHero.textContent = hud.isBig ? "👑 超级奶娃" : "奶娃";
      hudCoins.textContent = String(hud.coins).padStart(2, "0");
      hudScore.textContent = String(hud.score);
      hudTimer.textContent = hud.runStarted ? fmt(hud.timeMs) : "00:00.000";
    },
    onStageChange: updateStageUi,
    onNearbyNpcChange: (npc) => {
      if (npc) {
        npcTalkBtn.textContent = `💬 与${npc.name}对话 (E)`;
        npcTalkBtn.classList.remove("hidden");
      } else {
        npcTalkBtn.classList.add("hidden");
      }
    },
    onDialogueChange: (dlg) => {
      if (!dlg) {
        dialogueBox.classList.add("hidden");
        return;
      }
      const portraitUrl = window.SpriteBank.npcPortraits[dlg.type];
      if (portraitUrl) dialoguePortrait.src = portraitUrl;
      dialogueSpeaker.textContent = `${dlg.name} · ${dlg.title}`;
      dialogueText.textContent = dlg.text;
      dialogueNext.textContent = dlg.hasNext
        ? `点击此处或按 Space / E 继续 (${dlg.lineIndex + 1}/${dlg.totalLines}) ▼`
        : "点击此处或按 Space / E 结束对话 ✔";
      dialogueBox.classList.remove("hidden");
    },
    onPauseChange: (isPaused) => {
      pauseOverlay.classList.toggle("hidden", !isPaused);
      pauseBtn.textContent = isPaused ? "▶ 继续" : "⏸ 暂停";
    },
    onRestart: () => {
      victoryModal.classList.add("hidden");
      stageClearModal.classList.add("hidden");
      pauseOverlay.classList.add("hidden");
      pauseBtn.textContent = "⏸ 暂停";
    },
    onStageClear: (result) => {
      pendingStageResult = result;
      const curInfo = STAGE_INFO[result.stage];
      const nextInfo = STAGE_INFO[result.stage + 1];
      stageClearTitle.textContent = `🚩 ${curInfo.code} ${curInfo.name} 通关！`;
      stageClearStory.textContent = STAGE_TRANSITION_STORY[result.stage] || "";
      stageClearTime.textContent = fmt(result.timeMs);
      stageClearScore.textContent = `${result.score} 分 / ${result.coins} 币`;
      nextStageBtn.textContent = `▶ 前往第 ${nextInfo.num} 关：${nextInfo.name}`;
      submitStage1Btn.classList.toggle("hidden", !(result.stage === 1 && result.fullCampaign));

      game.modalOpen = true;
      stageClearModal.classList.remove("hidden");
    },
    onVictory: async (result) => {
      if (result.fullCampaign) {
        await submitAndShowVictory(result, "🎉 勇者凯旋！全四关通关！");
      } else {
        victoryTitle.textContent = "🐉 击败深渊红龙！救出莉莉娅公主！";
        victoryTime.textContent = fmt(result.timeMs);
        victoryRank.textContent = "单关练习";
        victoryScore.textContent = `${result.score} 分 / ${result.coins} 币`;
        victoryRoute.textContent = "从 1-1 连闯可入榜";
        victoryPbBanner.classList.add("hidden");
        game.modalOpen = true;
        victoryModal.classList.remove("hidden");
      }
    }
  });

  game.startLoop();

  // 关卡切换按钮
  stageButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetStage = Number(btn.getAttribute("data-stage"));
      Audio.init();
      Audio.sfxClick();
      victoryModal.classList.add("hidden");
      stageClearModal.classList.add("hidden");
      pauseOverlay.classList.add("hidden");
      welcomeModal.classList.add("hidden");
      game.startStage(targetStage, { keepProgress: false, autoUnpause: true });
      focusGameCanvas();
    });
  });

  // 过关转场按钮
  nextStageBtn.addEventListener("click", () => {
    if (!pendingStageResult) return;
    Audio.sfxClick();
    stageClearModal.classList.add("hidden");
    game.startStage(pendingStageResult.stage + 1, { keepProgress: true, autoUnpause: true });
    focusGameCanvas();
  });

  submitStage1Btn.addEventListener("click", async () => {
    if (!pendingStageResult) return;
    Audio.sfxClick();
    stageClearModal.classList.add("hidden");
    await submitAndShowVictory(pendingStageResult, "🏆 第一关速通结算！");
  });

  stageRetryBtn.addEventListener("click", () => {
    if (!pendingStageResult) return;
    Audio.sfxClick();
    stageClearModal.classList.add("hidden");
    game.startStage(pendingStageResult.stage, { keepProgress: false, autoUnpause: true });
    focusGameCanvas();
  });

  // NPC 对话触发与点击推进
  npcTalkBtn.addEventListener("click", () => {
    Audio.init();
    game.interactNearbyNpc();
    focusGameCanvas();
  });

  dialogueBox.addEventListener("click", () => {
    game.advanceDialogue();
    focusGameCanvas();
  });

  function focusGameCanvas() {
    if (document.activeElement && document.activeElement !== canvas && document.activeElement.blur) {
      document.activeElement.blur();
    }
    canvas.focus?.({ preventScroll: true });
  }

  canvas.addEventListener("pointerdown", () => {
    if (!game.modalOpen) focusGameCanvas();
  });

  // 关闭启动作者弹窗并开始游戏
  function enterGameFromWelcome() {
    const cleanName = LB.setPlayerName(playerInput.value);
    playerInput.value = cleanName;
    headerPlayerName.textContent = cleanName;

    Audio.init();
    Audio.sfxClick();
    welcomeModal.classList.add("hidden");
    game.modalOpen = false;
    game.setPaused(false);
    pauseOverlay.classList.add("hidden");
    pauseBtn.textContent = "⏸ 暂停";
    focusGameCanvas();
  }

  startGameBtn.addEventListener("click", enterGameFromWelcome);
  playerInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") enterGameFromWelcome();
  });

  openAuthorBtn.addEventListener("click", () => {
    Audio.sfxClick();
    game.modalOpen = true;
    game.setPaused(true);
    authorModal.classList.remove("hidden");
  });

  function closeAuthorModal() {
    Audio.sfxClick();
    authorModal.classList.add("hidden");
    game.modalOpen = false;
    game.setPaused(false);
    pauseOverlay.classList.add("hidden");
    pauseBtn.textContent = "⏸ 暂停";
    focusGameCanvas();
  }

  closeAuthorBtn.addEventListener("click", closeAuthorModal);
  authorModal.addEventListener("click", (e) => {
    if (e.target === authorModal) closeAuthorModal();
  });

  victoryRetryBtn.addEventListener("click", () => {
    Audio.sfxClick();
    victoryModal.classList.add("hidden");
    stageClearModal.classList.add("hidden");
    game.startStage(1, { keepProgress: false, autoUnpause: true });
    pauseOverlay.classList.add("hidden");
    focusGameCanvas();
  });

  victoryCloseBtn.addEventListener("click", () => {
    Audio.sfxClick();
    victoryModal.classList.add("hidden");
    game.modalOpen = false;
    focusGameCanvas();
  });

  restartBtn.addEventListener("click", () => {
    Audio.sfxClick();
    victoryModal.classList.add("hidden");
    stageClearModal.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    game.resetGameState(true);
    focusGameCanvas();
  });

  pauseBtn.addEventListener("click", () => {
    if (game.modalOpen || game.state !== "playing") return;
    Audio.sfxClick();
    const next = !game.paused;
    game.setPaused(next);
    pauseOverlay.classList.toggle("hidden", !next);
    pauseBtn.textContent = next ? "▶ 继续" : "⏸ 暂停";
    focusGameCanvas();
  });

  muteBtn.addEventListener("click", () => {
    Audio.init();
    const nextMute = !Audio.muted;
    Audio.setMuted(nextMute);
    muteBtn.textContent = nextMute ? "🔇 已静音" : "🔊 音效开";
    if (!nextMute) Audio.sfxClick();
    if (!game.modalOpen) focusGameCanvas();
  });

  // 排行榜实时渲染
  function renderLeaderboard(snap) {
    headerPlayerName.textContent = snap.playerName;
    hudPb.textContent = snap.personalBest ? fmt(snap.personalBest.timeMs) : "--:--.---";

    if (snap.cloudEnabled) {
      if (snap.cloudStatus === "cloud-ok") {
        lbLiveText.textContent = "云端实时同步";
        lbLiveText.parentElement.title = "云端连接正常";
      } else if (snap.cloudStatus === "cloud-syncing") {
        lbLiveText.textContent = "云端同步中...";
      } else {
        lbLiveText.textContent = "云端连接异常";
        lbLiveText.parentElement.title = snap.cloudError || "请检查 Supabase 权限或 URL";
      }
    } else {
      lbLiveText.textContent = "本地实时榜";
      lbLiveText.parentElement.title = "";
    }

    tabAllBtn.classList.toggle("active", snap.filterMode === "all");
    tabPlayerBtn.classList.toggle("active", snap.filterMode === "player");

    lbList.innerHTML = "";
    if (snap.runs.length === 0) {
      const empty = document.createElement("li");
      empty.className = "lb-row";
      empty.style.gridTemplateColumns = "1fr";
      empty.style.textAlign = "center";
      empty.style.color = "#aeb9e6";
      empty.textContent = "暂无玩家速通记录，快去冲刺终点旗杆吧！";
      lbList.appendChild(empty);
      return;
    }

    snap.runs.forEach((item, idx) => {
      const rank = idx + 1;
      const li = document.createElement("li");
      const isMe = !item.isNpc && item.name === snap.playerName;
      li.className = "lb-row" + (isMe ? " me" : "");
      if (item.id === lastHighlightRunId) {
        li.style.boxShadow = "inset 0 0 0 2px #58e068";
      }

      const rankEl = document.createElement("div");
      rankEl.className = "lb-rank" + (rank <= 3 ? ` r${rank}` : "");
      rankEl.textContent = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

      const infoEl = document.createElement("div");
      infoEl.className = "lb-name-wrap";

      const nameEl = document.createElement("div");
      nameEl.className = "lb-name";
      nameEl.textContent = item.name;

      const metaEl = document.createElement("div");
      metaEl.className = "lb-meta";
      if (item.isNpc) {
        const npcTag = document.createElement("span");
        npcTag.className = "badge-npc";
        npcTag.textContent = "NPC基准";
        metaEl.appendChild(npcTag);
      }
      if (item.route === "密道捷径") {
        const routeTag = document.createElement("span");
        routeTag.className = "badge-shortcut";
        routeTag.textContent = "密道";
        metaEl.appendChild(routeTag);
      }
      const coinSpan = document.createElement("span");
      coinSpan.textContent = `🪙${item.coins || 0} · ${item.score || 0}分`;
      metaEl.appendChild(coinSpan);

      infoEl.appendChild(nameEl);
      infoEl.appendChild(metaEl);

      const timeEl = document.createElement("div");
      timeEl.className = "lb-time";
      timeEl.textContent = fmt(item.timeMs);

      li.appendChild(rankEl);
      li.appendChild(infoEl);
      li.appendChild(timeEl);
      lbList.appendChild(li);
    });
  }

  LB.subscribe(renderLeaderboard);

  tabAllBtn.addEventListener("click", () => {
    Audio.sfxClick();
    LB.setFilterMode("all");
  });
  tabPlayerBtn.addEventListener("click", () => {
    Audio.sfxClick();
    LB.setFilterMode("player");
  });
  clearRunsBtn.addEventListener("click", () => {
    Audio.sfxClick();
    if (confirm("确定要清空本地保存的速通记录吗？")) {
      LB.clearLocalRuns();
    }
  });

  // 云端设置弹窗
  openCloudBtn.addEventListener("click", () => {
    Audio.sfxClick();
    const cfg = LB.getCloudConfig();
    cloudUrlInput.value = cfg.supabaseUrl;
    cloudKeyInput.value = cfg.supabaseAnonKey;
    cloudTableInput.value = cfg.tableName;
    game.modalOpen = true;
    game.setPaused(true);
    cloudModal.classList.remove("hidden");
  });

  saveCloudBtn.addEventListener("click", () => {
    Audio.sfxClick();
    LB.setCloudConfig(cloudUrlInput.value, cloudKeyInput.value, cloudTableInput.value);
    cloudModal.classList.add("hidden");
    game.modalOpen = false;
    game.setPaused(false);
  });

  cancelCloudBtn.addEventListener("click", () => {
    Audio.sfxClick();
    cloudModal.classList.add("hidden");
    game.modalOpen = false;
    game.setPaused(false);
  });

  // 移动端多点触控手柄：
  // 1) 方向盘支持单指滑动切换 ◀ / ▼ / ▶
  const touchDpad = document.getElementById("touch-dpad");
  if (touchDpad) {
    const dpadButtons = Array.from(touchDpad.querySelectorAll("[data-touch-dpad]"));
    const pointerDirs = new Map(); // pointerId -> 'left' | 'down' | 'right' | null

    const syncDpad = () => {
      const activeDirs = new Set(pointerDirs.values());
      ["left", "down", "right"].forEach((dir) => {
        game.setTouchInput(dir, activeDirs.has(dir));
      });
      dpadButtons.forEach((b) => {
        b.classList.toggle("is-active", activeDirs.has(b.getAttribute("data-touch-dpad")));
      });
    };

    const hitDir = (clientX, clientY) => {
      const el = document.elementFromPoint(clientX, clientY);
      const btn = el && el.closest ? el.closest("[data-touch-dpad]") : null;
      return btn ? btn.getAttribute("data-touch-dpad") : null;
    };

    touchDpad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      Audio.init();
      try { touchDpad.setPointerCapture(e.pointerId); } catch (_) {}
      pointerDirs.set(e.pointerId, hitDir(e.clientX, e.clientY));
      syncDpad();
    });

    touchDpad.addEventListener("pointermove", (e) => {
      if (!pointerDirs.has(e.pointerId)) return;
      e.preventDefault();
      const nextDir = hitDir(e.clientX, e.clientY);
      if (pointerDirs.get(e.pointerId) !== nextDir) {
        pointerDirs.set(e.pointerId, nextDir);
        syncDpad();
      }
    });

    const endDpad = (e) => {
      if (!pointerDirs.has(e.pointerId)) return;
      e.preventDefault();
      pointerDirs.delete(e.pointerId);
      syncDpad();
    };

    touchDpad.addEventListener("pointerup", endDpad);
    touchDpad.addEventListener("pointercancel", endDpad);
    touchDpad.addEventListener("lostpointercapture", endDpad);
    touchDpad.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // 2) 冲刺锁定开关：点一下常驻冲刺，双指即可同时方向+冲刺+跳跃
  const sprintToggleBtn = document.getElementById("touch-sprint-toggle");
  let sprintLocked = false;
  function updateSprintToggleUi() {
    if (!sprintToggleBtn) return;
    sprintToggleBtn.classList.toggle("is-on", sprintLocked);
    sprintToggleBtn.textContent = sprintLocked ? "⚡ 冲刺:开" : "⚡ 冲刺:关";
  }
  if (sprintToggleBtn) {
    sprintToggleBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      Audio.init();
      Audio.sfxClick();
      sprintLocked = !sprintLocked;
      game.setTouchInput("sprint", sprintLocked);
      updateSprintToggleUi();
    });
    sprintToggleBtn.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("blur", () => {
      sprintLocked = false;
      updateSprintToggleUi();
    });
  }

  // 3) 跳跃键独立多点触控绑定
  document.querySelectorAll("[data-touch-key]").forEach((btn) => {
    const key = btn.getAttribute("data-touch-key");
    const activePointers = new Set();

    const press = (e) => {
      e.preventDefault();
      Audio.init();
      activePointers.add(e.pointerId);
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      btn.classList.add("is-active");
      game.setTouchInput(key, true);
    };

    const release = (e) => {
      e.preventDefault();
      activePointers.delete(e.pointerId);
      if (activePointers.size === 0) {
        btn.classList.remove("is-active");
        game.setTouchInput(key, false);
      }
    };

    btn.addEventListener("pointerdown", press);
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("lostpointercapture", release);
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  });
})();
