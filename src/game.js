/**
 * 《奶娃之旅》核心游戏引擎 (60fps 固定步长物理 + 全4关剧情/NPC对话/恶龙Boss战)
 * 作者: forgivez
 */
(function () {
  const CFG = window.NAIWA_CONFIG;
  const T = CFG.TILE_SIZE; // 16
  const VW = CFG.VIEW_WIDTH; // 400
  const VH = CFG.VIEW_HEIGHT; // 240
  const SOLID = window.NaiwaLevels.TILE_SOLID;
  const PLATFORM = window.NaiwaLevels.TILE_PLATFORM;
  const HAZARD = window.NaiwaLevels.TILE_HAZARD;

  const FIXED_DT = 1000 / 60;

  class NaiwaGame {
    constructor(canvas, callbacks = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = false;
      this.callbacks = callbacks;

      this.heldKeys = new Set();
      this.touchState = {
        left: false,
        right: false,
        down: false,
        jump: false,
        sprint: false
      };

      this.input = {
        left: false,
        right: false,
        down: false,
        jumpHeld: false,
        jumpPressedBuffer: 0,
        sprint: false
      };

      this.currentStage = 1;
      this.campaignStartStage = 1;

      this.paused = true; // 打开时先展示欢迎弹窗
      this.modalOpen = true;
      this.dialogueState = null; // { npc, lineIndex }
      this.nearbyNpc = null;

      this.rafId = null;
      this.lastFrameTime = 0;
      this.accumulator = 0;
      this.tickCount = 0;

      this.startStage(1, { keepProgress: false, autoUnpause: false });
      this._bindInput();
    }

    startStage(stageNum = 1, { keepProgress = false, autoUnpause = true } = {}) {
      const prevBig = keepProgress && this.player ? this.player.isBig : false;
      if (!keepProgress) {
        this.campaignStartStage = stageNum;
        this.score = 0;
        this.coins = 0;
        this.lives = 3;
        this.usedShortcut = false;
        this.runStarted = false;
        this.runFinished = false;
        this.runElapsedMs = 0;
      }

      this.currentStage = stageNum;
      this.levels = window.NaiwaLevels.createStageState(stageNum);
      const startZone = stageNum === 1 ? "overworld" : "main";

      this.cameraX = 0;
      this.state = "playing"; // 'playing' | 'warping' | 'dying' | 'flag_slide' | 'castle_walk' | 'bridge_collapse' | 'princess_walk' | 'victory'
      this.stateTimer = 0;
      this.warpInfo = null;
      this.dialogueState = null;
      this.nearbyNpc = null;

      this.entities = [];
      this.enemies = [];
      this.particles = [];
      this.popups = [];
      this.bossFireballs = [];
      this.tileBumps = new Map();
      this.collectedBonusCoins = new Set();
      this.axeCollected = false;

      this._initZoneEntities(startZone);

      this.player = this._createPlayer(this.level.spawn.x, this.level.spawn.y, prevBig);
      this.flagY = 3 * T;

      if (autoUnpause) {
        this.paused = false;
        this.modalOpen = false;
        window.RetroAudio.startBgm(this.level.bgm || "overworld");
      }

      if (this.callbacks.onDialogueChange) this.callbacks.onDialogueChange(null);
      if (this.callbacks.onNearbyNpcChange) this.callbacks.onNearbyNpcChange(null);
      if (this.callbacks.onStageChange) this.callbacks.onStageChange(this.currentStage);
      this._emitHud();
    }

    resetGameState(autoUnpause = false) {
      this.startStage(this.currentStage, { keepProgress: false, autoUnpause });
    }

    _createPlayer(x, y, preserveBig = false) {
      return {
        x,
        y,
        vx: 0,
        vy: 0,
        w: 12,
        h: preserveBig ? 24 : 20,
        facingRight: true,
        onGround: false,
        coyoteTimer: 0,
        isBig: preserveBig,
        invulnTimer: 0,
        starTimer: 0,
        walkAnim: 0,
        combo: 0
      };
    }

    _initZoneEntities(zoneName) {
      const lv = this.levels[zoneName];
      this.zone = zoneName;
      this.level = lv;
      this.entities = [];
      this.bossFireballs = [];
      this.tileBumps.clear();

      this.enemies = (lv.enemies || []).map((e) => ({
        type: e.type,
        x: e.x,
        y: e.y,
        vx: -0.65,
        vy: 0,
        w: 14,
        h: e.type === "koopa" ? 18 : 14,
        active: false,
        state: "walk",
        timer: 0,
        anim: 0
      }));

      this.npcs = (lv.npcs || []).map((n) => ({ ...n, anim: Math.random() * 10 }));

      this.fireballs = (lv.fireballs || []).map((f) => ({ ...f, y: f.baseY }));

      if (lv.boss) {
        this.boss = {
          ...lv.boss,
          vx: -0.7,
          vy: 0,
          active: false,
          alive: true,
          falling: false,
          flashTimer: 0,
          fireCooldown: 90,
          jumpCooldown: 110,
          anim: 0
        };
      } else {
        this.boss = null;
      }
    }

    startLoop() {
      if (this.rafId) return;
      this.lastFrameTime = performance.now();
      const loop = (now) => {
        const delta = Math.min(100, now - this.lastFrameTime);
        this.lastFrameTime = now;

        if (!this.paused) {
          this.accumulator += delta;
          while (this.accumulator >= FIXED_DT) {
            this.updateFixed();
            this.accumulator -= FIXED_DT;
          }
        }
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    setPaused(paused) {
      this.paused = paused;
      if (paused) {
        window.RetroAudio.stopBgm();
      } else if (this.state === "playing") {
        const track = this.player.starTimer > 0
          ? "star"
          : (this.level.bgm || "overworld");
        window.RetroAudio.startBgm(track);
      }
    }

    // NPC 对话触发与推进（无配音）
    interactNearbyNpc() {
      if (this.state !== "playing" || !this.nearbyNpc || this.dialogueState) return false;
      this._openDialogue(this.nearbyNpc, false);
      return true;
    }

    _openDialogue(npc, isEnding = false) {
      this.dialogueState = { npc, lineIndex: 0, isEnding };
      this.heldKeys.clear();
      Object.keys(this.touchState).forEach((k) => {
        if (k !== "sprint") this.touchState[k] = false;
      });
      this._syncInputFromHeld();
      if (this.callbacks.onDialogueChange) {
        this.callbacks.onDialogueChange({
          name: npc.name,
          title: npc.title,
          type: npc.type,
          text: npc.lines[0],
          hasNext: npc.lines.length > 1,
          lineIndex: 0,
          totalLines: npc.lines.length
        });
      }
    }

    advanceDialogue() {
      if (!this.dialogueState) return;
      const { npc, lineIndex, isEnding } = this.dialogueState;
      const next = lineIndex + 1;
      if (next < npc.lines.length) {
        this.dialogueState.lineIndex = next;
        if (this.callbacks.onDialogueChange) {
          this.callbacks.onDialogueChange({
            name: npc.name,
            title: npc.title,
            type: npc.type,
            text: npc.lines[next],
            hasNext: next + 1 < npc.lines.length,
            lineIndex: next,
            totalLines: npc.lines.length
          });
        }
      } else {
        this.dialogueState = null;
        if (this.callbacks.onDialogueChange) this.callbacks.onDialogueChange(null);
        if (isEnding) {
          this._finishStage4Victory();
        }
      }
    }

    _syncInputFromHeld() {
      const hasAny = (codes) => codes.some((c) => this.heldKeys.has(c));
      this.input.left = this.touchState.left || hasAny(["ArrowLeft", "KeyA", "Numpad4"]);
      this.input.right = this.touchState.right || hasAny(["ArrowRight", "KeyD", "Numpad6"]);
      this.input.down = this.touchState.down || hasAny(["ArrowDown", "KeyS", "Numpad2"]);
      this.input.sprint = this.touchState.sprint || hasAny(["ShiftLeft", "ShiftRight", "KeyX", "KeyJ"]);
      this.input.jumpHeld = this.touchState.jump || hasAny(["ArrowUp", "KeyW", "Space", "KeyZ", "KeyK", "Numpad8"]);
    }

    setTouchInput(key, pressed) {
      if (key === "jump") {
        if (pressed && !this.touchState.jump) {
          this.input.jumpPressedBuffer = 10;
        }
        this.touchState.jump = pressed;
      } else if (key in this.touchState) {
        this.touchState[key] = pressed;
      }
      this._syncInputFromHeld();
    }

    _resolveControlCode(e) {
      if (e.code) return e.code;
      const k = (e.key || "").toLowerCase();
      const map = {
        arrowleft: "ArrowLeft",
        arrowright: "ArrowRight",
        arrowup: "ArrowUp",
        arrowdown: "ArrowDown",
        " ": "Space",
        spacebar: "Space",
        a: "KeyA",
        d: "KeyD",
        w: "KeyW",
        s: "KeyS",
        e: "KeyE",
        f: "KeyF",
        enter: "Enter",
        z: "KeyZ",
        x: "KeyX",
        j: "KeyJ",
        k: "KeyK",
        r: "KeyR",
        p: "KeyP",
        escape: "Escape",
        shift: "ShiftLeft"
      };
      return map[k] || "";
    }

    _bindInput() {
      const GAME_CODES = new Set([
        "ArrowLeft", "KeyA", "Numpad4",
        "ArrowRight", "KeyD", "Numpad6",
        "ArrowDown", "KeyS", "Numpad2",
        "ArrowUp", "KeyW", "Space", "KeyZ", "KeyK", "Numpad8",
        "ShiftLeft", "ShiftRight", "KeyX", "KeyJ",
        "KeyE", "KeyF", "Enter",
        "KeyR", "KeyP", "Escape"
      ]);
      const JUMP_CODES = new Set(["ArrowUp", "KeyW", "Space", "KeyZ", "KeyK", "Numpad8"]);
      const DIALOGUE_CODES = new Set(["KeyE", "KeyF", "Enter", "Space"]);

      const onKeyDown = (e) => {
        if (this.modalOpen) return;
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        const code = this._resolveControlCode(e);
        if (!GAME_CODES.has(code)) return;

        e.preventDefault();

        // 对话框打开时优先推进/关闭对话
        if (this.dialogueState) {
          if (!e.repeat && (DIALOGUE_CODES.has(code) || code === "Escape")) {
            this.advanceDialogue();
          }
          return;
        }

        if (code === "KeyR") {
          if (!e.repeat) {
            window.RetroAudio.sfxClick();
            this.resetGameState(true);
            if (this.callbacks.onRestart) this.callbacks.onRestart();
          }
          return;
        }

        if (code === "KeyP" || code === "Escape") {
          if (!e.repeat && this.state === "playing") {
            this.setPaused(!this.paused);
            if (this.callbacks.onPauseChange) this.callbacks.onPauseChange(this.paused);
          }
          return;
        }

        if ((code === "KeyE" || code === "KeyF" || code === "Enter") && !e.repeat) {
          this.interactNearbyNpc();
          return;
        }

        const wasDown = this.heldKeys.has(code);
        this.heldKeys.add(code);
        if (JUMP_CODES.has(code) && !wasDown) {
          this.input.jumpPressedBuffer = 10;
        }
        this._syncInputFromHeld();
      };

      const onKeyUp = (e) => {
        const code = this._resolveControlCode(e);
        if (!code) return;
        if (this.heldKeys.has(code)) {
          this.heldKeys.delete(code);
          this._syncInputFromHeld();
        }
      };

      window.addEventListener("keydown", onKeyDown, { capture: true });
      window.addEventListener("keyup", onKeyUp, { capture: true });
      window.addEventListener("blur", () => {
        this.heldKeys.clear();
        Object.keys(this.touchState).forEach((k) => { this.touchState[k] = false; });
        this._syncInputFromHeld();
      });
    }

    updateFixed() {
      this.tickCount++;

      // 对话期间动画照常微动，但暂停物理与速通计时，让玩家可以放心读剧情！
      if (this.dialogueState) {
        this._updateNpcs();
        this._updateParticles();
        return;
      }

      if (this.state === "playing" || this.state === "warping") {
        if (!this.runStarted) {
          if (this.input.left || this.input.right || this.input.jumpHeld || this.input.down) {
            this.runStarted = true;
          }
        }
        if (this.runStarted && !this.runFinished) {
          this.runElapsedMs += FIXED_DT;
        }
      }

      this.tileBumps.forEach((val, key) => {
        val.vel += 0.35;
        val.off += val.vel;
        if (val.off >= 0) this.tileBumps.delete(key);
      });

      this._updateParticles();
      this._updatePopups();
      this._updateNpcs();

      if (this.state === "warping") {
        this._updateWarp();
        return;
      }
      if (this.state === "dying") {
        this._updateDying();
        return;
      }
      if (this.state === "flag_slide") {
        this._updateFlagSlide();
        return;
      }
      if (this.state === "castle_walk") {
        this._updateCastleWalk();
        return;
      }
      if (this.state === "bridge_collapse") {
        this._updateBridgeCollapse();
        return;
      }
      if (this.state === "princess_walk") {
        this._updatePrincessWalk();
        return;
      }
      if (this.state === "victory") {
        this.stateTimer++;
        if (this.stateTimer === 25 || this.stateTimer === 50 || this.stateTimer === 75) {
          this._spawnFirework();
        }
        return;
      }

      this._updatePlayer();
      this._updateEntities();
      this._updateEnemies();
      this._updateHazards();
      this._updateBoss();
      this._checkBonusCoins();
      this._updateCamera();
      this._emitHud();
    }

    _updateNpcs() {
      const p = this.player;
      let nearest = null;
      let bestDist = Infinity;

      for (const npc of this.npcs) {
        npc.anim += 0.04;
        // 1-4 击败恶龙前，公主只呼救不触发常规对话
        if (npc.isPrincess && this.boss && this.boss.alive) continue;

        const dx = Math.abs((p.x + p.w / 2) - (npc.x + 8));
        const dy = Math.abs((p.y + p.h / 2) - (npc.y + 11));
        if (dx <= 28 && dy <= 28 && dx < bestDist) {
          bestDist = dx;
          nearest = npc;
        }
        // NPC 朝向面向玩家
        npc.facingRight = p.x + p.w / 2 > npc.x + 8;
      }

      if (nearest !== this.nearbyNpc) {
        this.nearbyNpc = nearest;
        if (this.callbacks.onNearbyNpcChange) {
          this.callbacks.onNearbyNpcChange(nearest ? { name: nearest.name, type: nearest.type } : null);
        }
      }
    }

    _updatePlayer() {
      const p = this.player;
      if (this.input.jumpPressedBuffer > 0) this.input.jumpPressedBuffer--;
      if (p.invulnTimer > 0) p.invulnTimer--;

      if (p.starTimer > 0) {
        p.starTimer--;
        if (p.starTimer === 0) {
          window.RetroAudio.startBgm(this.level.bgm || "overworld");
        }
      }

      const starMult = p.starTimer > 0 ? 1.22 : 1.0;
      const maxSpeed = (this.input.sprint ? 2.68 : 1.72) * starMult;
      const accel = p.onGround ? (this.input.sprint ? 0.14 : 0.095) : 0.075;
      const friction = p.onGround ? 0.11 : 0.025;

      if (this.input.left && !this.input.right) {
        p.vx = Math.max(-maxSpeed, p.vx - accel);
        p.facingRight = false;
      } else if (this.input.right && !this.input.left) {
        p.vx = Math.min(maxSpeed, p.vx + accel);
        p.facingRight = true;
      } else {
        if (Math.abs(p.vx) <= friction) p.vx = 0;
        else p.vx -= Math.sign(p.vx) * friction;
      }

      if (p.onGround) {
        p.coyoteTimer = 6;
        p.combo = 0;
      } else if (p.coyoteTimer > 0) {
        p.coyoteTimer--;
      }

      if (this.input.jumpPressedBuffer > 0 && p.coyoteTimer > 0) {
        p.vy = -4.45 - Math.min(0.45, Math.abs(p.vx) * 0.14);
        p.onGround = false;
        p.coyoteTimer = 0;
        this.input.jumpPressedBuffer = 0;
        window.RetroAudio.sfxJump(p.isBig);
      }

      const grav = p.vy < 0 && this.input.jumpHeld ? 0.155 : 0.34;
      p.vy = Math.min(5.2, p.vy + grav);

      p.x += p.vx;
      if (p.x < this.cameraX) {
        p.x = this.cameraX;
        if (p.vx < 0) p.vx = 0;
      }
      if (p.x + p.w > this.level.cols * T) {
        p.x = this.level.cols * T - p.w;
      }
      this._resolveHorizontal(p);

      p.y += p.vy;
      const hitHead = this._resolveVertical(p);
      if (hitHead) {
        this._handleHeadBump(hitHead.c, hitHead.r);
      }

      if (p.onGround && Math.abs(p.vx) > 0.15) {
        p.walkAnim += Math.abs(p.vx) * 0.16;
      } else {
        p.walkAnim = 0;
      }

      // 传送水管检测
      if (p.onGround && this.level.warpPipes) {
        const centerCol = Math.floor((p.x + p.w / 2) / T);
        const footRow = Math.floor((p.y + p.h + 1) / T);
        for (const wp of this.level.warpPipes) {
          const onPipeTop = (centerCol === wp.col || centerCol === wp.col + 1) && footRow === wp.topRow;
          if (onPipeTop && (this.input.down || (this.zone === "underground" && wp.sideEnter))) {
            this._beginWarp(wp);
            return;
          }
        }
      }

      // 岩浆或深坑死亡检测
      if (p.y > VH + 16 || this._touchesHazard(p)) {
        this._triggerDeath();
        return;
      }

      // 1-4 触碰黄金战斧砍断铁桥击败恶龙
      if (this.boss && this.boss.alive && !this.axeCollected) {
        const axeBox = { x: this.boss.axeCol * T + 1, y: this.boss.axeRow * T + 1, w: 14, h: 14 };
        if (this._rectsOverlap(p, axeBox)) {
          this._triggerAxeDefeat();
          return;
        }
      }

      // 1-1 / 1-2 / 1-3 触碰终点旗杆
      if (this.level.flagCol && p.x + p.w >= this.level.flagCol * T + 5) {
        this._triggerFlagpole();
      }
    }

    _touchesHazard(ent) {
      const left = Math.floor((ent.x + 2) / T);
      const right = Math.floor((ent.x + ent.w - 2) / T);
      const top = Math.floor((ent.y + 4) / T);
      const bottom = Math.floor((ent.y + ent.h - 1) / T);
      for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
          if (HAZARD.has(this._tileAt(c, r))) return true;
        }
      }
      return false;
    }

    _tileAt(c, r) {
      if (r < 0) return ".";
      if (r >= this.level.rows || c < 0 || c >= this.level.cols) return ".";
      return this.level.grid[r][c];
    }

    _isSolidAt(c, r) {
      const tile = this._tileAt(c, r);
      if (!SOLID.has(tile)) return false;
      const meta = this.level.blockMeta[`${c},${r}`];
      if (meta && meta.hidden) return false;
      return true;
    }

    _isStandableAt(c, r, prevBottom) {
      if (this._isSolidAt(c, r)) return true;
      const tile = this._tileAt(c, r);
      if (PLATFORM.has(tile)) {
        return prevBottom <= r * T + 4;
      }
      return false;
    }

    _resolveHorizontal(ent) {
      const top = Math.floor(ent.y / T);
      const bottom = Math.floor((ent.y + ent.h - 0.01) / T);
      if (ent.vx > 0) {
        const right = Math.floor((ent.x + ent.w) / T);
        for (let r = top; r <= bottom; r++) {
          if (this._isSolidAt(right, r)) {
            ent.x = right * T - ent.w;
            ent.vx = 0;
            return true;
          }
        }
      } else if (ent.vx < 0) {
        const left = Math.floor(ent.x / T);
        for (let r = top; r <= bottom; r++) {
          if (this._isSolidAt(left, r)) {
            ent.x = (left + 1) * T;
            ent.vx = 0;
            return true;
          }
        }
      }
      return false;
    }

    _resolveVertical(ent) {
      const left = Math.floor((ent.x + 1) / T);
      const right = Math.floor((ent.x + ent.w - 1) / T);
      if (ent.vy >= 0) {
        const prevBottom = ent.y + ent.h - ent.vy;
        const bottom = Math.floor((ent.y + ent.h) / T);
        ent.onGround = false;
        for (let c = left; c <= right; c++) {
          if (this._isStandableAt(c, bottom, prevBottom)) {
            ent.y = bottom * T - ent.h;
            ent.vy = 0;
            ent.onGround = true;
            return null;
          }
        }
      } else {
        const top = Math.floor(ent.y / T);
        for (let c = left; c <= right; c++) {
          const tile = this._tileAt(c, top);
          const meta = this.level.blockMeta[`${c},${top}`];
          if (SOLID.has(tile) || (meta && meta.hidden)) {
            const centerC = Math.floor((ent.x + ent.w / 2) / T);
            const hitC = (SOLID.has(this._tileAt(centerC, top)) || (this.level.blockMeta[`${centerC},${top}`]?.hidden))
              ? centerC : c;
            ent.y = (top + 1) * T;
            ent.vy = 0.2;
            return { c: hitC, r: top };
          }
        }
      }
      return null;
    }

    _handleHeadBump(c, r) {
      const tile = this._tileAt(c, r);
      const key = `${c},${r}`;
      const meta = this.level.blockMeta[key];

      for (const e of this.enemies) {
        if (e.state === "walk" || e.state === "shell" || e.state === "shell_slide") {
          const onTile = e.x + e.w > c * T && e.x < (c + 1) * T && Math.abs(e.y + e.h - r * T) < 4;
          if (onTile) {
            e.state = "flipped";
            e.vy = -3;
            e.vx = 0.8;
            this._addScore(100, e.x, e.y);
            window.RetroAudio.sfxKick();
          }
        }
      }

      if (meta && meta.hitsLeft > 0) {
        meta.hidden = false;
        meta.hitsLeft--;
        this.tileBumps.set(key, { off: 0, vel: -2.2 });

        if (meta.content === "coin" || meta.content === "multicoin") {
          this._collectCoin(c * T + 8, r * T);
          this.tileBumps.set(key, { off: 0, vel: -2.4 });
        } else if (meta.content === "milk") {
          window.RetroAudio.sfxPowerupAppear();
          this.entities.push({ type: "milk", x: c * T + 1, y: r * T - 14, vx: 0.9, vy: -1.5, w: 14, h: 14, emergeTimer: 14 });
        } else if (meta.content === "star") {
          window.RetroAudio.sfxPowerupAppear();
          this.entities.push({ type: "star", x: c * T + 1, y: r * T - 14, vx: 1.35, vy: -3.2, w: 14, h: 14, emergeTimer: 12 });
        } else if (meta.content === "1up") {
          window.RetroAudio.sfxPowerupAppear();
          this.entities.push({ type: "greenMilk", x: c * T + 1, y: r * T - 14, vx: 0.95, vy: -1.5, w: 14, h: 14, emergeTimer: 14 });
        }

        if (meta.hitsLeft <= 0) {
          this.level.grid[r][c] = "U";
        }
        return;
      }

      if (tile === "B") {
        if (this.player.isBig) {
          this.level.grid[r][c] = ".";
          this._spawnBrickDebris(c * T, r * T);
          this._addScore(50, c * T, r * T);
          window.RetroAudio.sfxBrickBreak();
        } else {
          this.tileBumps.set(key, { off: 0, vel: -2.0 });
          window.RetroAudio.sfxBump();
        }
      } else {
        window.RetroAudio.sfxBump();
      }
    }

    _updateEntities() {
      const p = this.player;
      for (let i = this.entities.length - 1; i >= 0; i--) {
        const it = this.entities[i];
        if (it.emergeTimer > 0) {
          it.emergeTimer--;
          continue;
        }
        if (it.type === "star") {
          it.vy = Math.min(4.2, it.vy + 0.18);
          it.x += it.vx;
          if (this._resolveHorizontalBounce(it)) it.vx = -it.vx;
          it.y += it.vy;
          if (this._resolveVerticalSimple(it)) it.vy = -3.3;
        } else {
          it.vy = Math.min(4.5, it.vy + 0.22);
          it.x += it.vx;
          if (this._resolveHorizontalBounce(it)) it.vx = -it.vx;
          it.y += it.vy;
          this._resolveVerticalSimple(it);
        }

        if (it.y > VH + 32) {
          this.entities.splice(i, 1);
          continue;
        }

        if (this._rectsOverlap(p, it)) {
          if (it.type === "milk") {
            if (!p.isBig) {
              const bottom = p.y + p.h;
              p.isBig = true;
              p.h = 24;
              p.y = bottom - p.h;
            }
            this._addScore(1000, it.x, it.y);
            this._addPopup("超级奶娃!", it.x, it.y - 10, "#FFE878");
            window.RetroAudio.sfxPowerup();
          } else if (it.type === "greenMilk") {
            this.lives++;
            this._addScore(1000, it.x, it.y);
            this._addPopup("1-UP!", it.x, it.y - 10, "#68F878");
            window.RetroAudio.sfxOneUp();
          } else if (it.type === "star") {
            p.starTimer = 540;
            this._addScore(1000, it.x, it.y);
            this._addPopup("无敌加速!", it.x, it.y - 10, "#FF88E8");
            window.RetroAudio.sfxPowerup();
            window.RetroAudio.startBgm("star");
          }
          this.entities.splice(i, 1);
        }
      }
    }

    _resolveHorizontalBounce(ent) {
      const top = Math.floor(ent.y / T);
      const bottom = Math.floor((ent.y + ent.h - 0.1) / T);
      if (ent.vx > 0) {
        const right = Math.floor((ent.x + ent.w) / T);
        for (let r = top; r <= bottom; r++) {
          if (this._isSolidAt(right, r)) {
            ent.x = right * T - ent.w;
            return true;
          }
        }
      } else if (ent.vx < 0) {
        const left = Math.floor(ent.x / T);
        for (let r = top; r <= bottom; r++) {
          if (this._isSolidAt(left, r)) {
            ent.x = (left + 1) * T;
            return true;
          }
        }
      }
      return false;
    }

    _resolveVerticalSimple(ent) {
      const left = Math.floor((ent.x + 1) / T);
      const right = Math.floor((ent.x + ent.w - 1) / T);
      if (ent.vy >= 0) {
        const prevBottom = ent.y + ent.h - ent.vy;
        const bottom = Math.floor((ent.y + ent.h) / T);
        for (let c = left; c <= right; c++) {
          if (this._isStandableAt(c, bottom, prevBottom)) {
            ent.y = bottom * T - ent.h;
            ent.vy = 0;
            return true;
          }
        }
      }
      return false;
    }

    _hurtPlayerOrDie() {
      const p = this.player;
      if (p.starTimer > 0 || p.invulnTimer > 0) return;
      if (p.isBig) {
        p.isBig = false;
        p.h = 20;
        p.y += 4;
        p.invulnTimer = 95;
        window.RetroAudio.sfxShrink();
        this._addPopup("护体失效!", p.x, p.y - 8, "#FF9060");
      } else {
        this._triggerDeath();
      }
    }

    _updateEnemies() {
      const p = this.player;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (!e.active) {
          if (e.x < this.cameraX + VW + 48) {
            e.active = true;
          } else {
            continue;
          }
        }

        if (e.state === "squashed") {
          e.timer--;
          if (e.timer <= 0) this.enemies.splice(i, 1);
          continue;
        }

        if (e.state === "flipped") {
          e.vy += 0.25;
          e.x += e.vx;
          e.y += e.vy;
          if (e.y > VH + 32) this.enemies.splice(i, 1);
          continue;
        }

        e.anim += 0.12;
        e.vy = Math.min(4.5, e.vy + 0.24);
        e.x += e.vx;
        if (this._resolveHorizontalBounce(e)) {
          e.vx = -e.vx;
          if (e.state === "shell_slide") window.RetroAudio.sfxBump();
        }
        e.y += e.vy;
        this._resolveVerticalSimple(e);

        if (e.y > VH + 32 || e.x < this.cameraX - 64) {
          this.enemies.splice(i, 1);
          continue;
        }

        if (e.state === "shell_slide") {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            if (i === j) continue;
            const other = this.enemies[j];
            if (other.active && other.state !== "flipped" && other.state !== "squashed") {
              if (this._rectsOverlap(e, other)) {
                other.state = "flipped";
                other.vy = -3.2;
                other.vx = Math.sign(e.vx) * 1.1;
                this._addScore(200, other.x, other.y);
                window.RetroAudio.sfxKick();
              }
            }
          }
        }

        if (this._rectsOverlap(p, e)) {
          if (p.starTimer > 0) {
            e.state = "flipped";
            e.vy = -3.5;
            e.vx = p.facingRight ? 1.5 : -1.5;
            this._addScore(200, e.x, e.y);
            window.RetroAudio.sfxKick();
            continue;
          }

          if (e.state === "shell") {
            const kickRight = p.x + p.w / 2 < e.x + e.w / 2;
            e.state = "shell_slide";
            e.vx = kickRight ? 3.7 : -3.7;
            e.x += kickRight ? 6 : -6;
            this._addScore(400, e.x, e.y);
            window.RetroAudio.sfxKick();
            continue;
          }

          const isStomp = p.vy > 0 && (p.y + p.h - p.vy) <= e.y + e.h * 0.65;
          if (isStomp) {
            p.vy = this.input.jumpHeld ? -4.1 : -3.1;
            p.combo++;
            const pts = Math.min(1000, 100 * p.combo);
            if (e.type === "goomba") {
              e.state = "squashed";
              e.timer = 24;
              e.vx = 0;
            } else if (e.type === "koopa") {
              e.state = "shell";
              e.vx = 0;
              e.h = 12;
              e.y += 6;
            }
            this._addScore(pts, e.x, e.y);
            window.RetroAudio.sfxStomp();
          } else {
            this._hurtPlayerOrDie();
            if (this.state === "dying") return;
          }
        }
      }
    }

    _updateHazards() {
      const p = this.player;
      for (const fb of this.fireballs) {
        fb.phase += fb.speed;
        const arc = Math.max(0, Math.sin(fb.phase));
        fb.y = fb.baseY - arc * fb.amp;
        if (arc > 0.08 && this._rectsOverlap(p, { x: fb.x, y: fb.y, w: 10, h: 8 })) {
          this._hurtPlayerOrDie();
          if (this.state === "dying") return;
        }
      }

      for (let i = this.bossFireballs.length - 1; i >= 0; i--) {
        const bf = this.bossFireballs[i];
        bf.x += bf.vx;
        bf.y += bf.vy;
        if (bf.x < this.cameraX - 24 || bf.x > this.level.cols * T) {
          this.bossFireballs.splice(i, 1);
          continue;
        }
        if (this._rectsOverlap(p, { x: bf.x, y: bf.y, w: 10, h: 8 })) {
          this.bossFireballs.splice(i, 1);
          this._hurtPlayerOrDie();
          if (this.state === "dying") return;
        }
      }
    }

    _updateBoss() {
      const b = this.boss;
      if (!b || !b.alive) return;

      if (!b.active) {
        if (this.cameraX + VW >= b.x - 40) {
          b.active = true;
        } else {
          return;
        }
      }

      if (b.flashTimer > 0) b.flashTimer--;
      b.anim += 0.12;

      // 恶龙巡逻、跳跃并喷射火球
      b.x += b.vx;
      const minX = (b.bridgeStartCol + 4) * T;
      const maxX = (b.bridgeEndCol - 2) * T;
      if (b.x <= minX) { b.x = minX; b.vx = Math.abs(b.vx); }
      if (b.x >= maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }

      b.vy = Math.min(4.2, b.vy + 0.16);
      b.y += b.vy;
      const floorY = b.bridgeRow * T - b.h;
      if (b.y >= floorY) {
        b.y = floorY;
        b.vy = 0;
      }

      b.jumpCooldown--;
      if (b.jumpCooldown <= 0 && b.y >= floorY - 1) {
        b.vy = -3.1;
        b.jumpCooldown = 95 + Math.floor(Math.random() * 45);
      }

      b.fireCooldown--;
      if (b.fireCooldown <= 0) {
        const dir = this.player.x < b.x ? -1 : 1;
        this.bossFireballs.push({
          x: dir < 0 ? b.x - 8 : b.x + b.w,
          y: b.y + 7,
          vx: dir * 2.15,
          vy: (Math.random() - 0.5) * 0.25
        });
        b.fireCooldown = 100 + Math.floor(Math.random() * 40);
      }

      // 与玩家碰撞：可踩头 3 下击败！
      const p = this.player;
      if (this._rectsOverlap(p, b)) {
        if (p.starTimer > 0) {
          b.hp = 0;
          this._defeatBossDirectly();
          return;
        }
        const isStomp = p.vy > 0 && (p.y + p.h - p.vy) <= b.y + b.h * 0.55;
        if (isStomp && b.flashTimer <= 0) {
          p.vy = -4.2;
          b.hp--;
          b.flashTimer = 35;
          if (b.hp <= 0) {
            this._defeatBossDirectly();
          } else {
            this._addScore(500, b.x, b.y);
            this._addPopup(`恶龙 HP ${b.hp}/3`, b.x - 6, b.y - 10, "#FFE878");
            window.RetroAudio.sfxBossHit();
          }
        } else if (b.flashTimer <= 0) {
          this._hurtPlayerOrDie();
        }
      }
    }

    _triggerAxeDefeat() {
      this.axeCollected = true;
      this.runFinished = true;
      this.state = "bridge_collapse";
      this.stateTimer = 0;
      this.collapseCol = this.boss.bridgeEndCol;
      this.bossFireballs = [];
      this.player.vx = 0;
      this.player.vy = 0;
      window.RetroAudio.stopBgm();
      window.RetroAudio.sfxAxe();
    }

    _updateBridgeCollapse() {
      this.stateTimer++;
      const b = this.boss;
      if (this.stateTimer % 4 === 0 && this.collapseCol >= b.bridgeStartCol) {
        this.level.grid[b.bridgeRow][this.collapseCol] = ".";
        this._spawnBrickDebris(this.collapseCol * T, b.bridgeRow * T);
        window.RetroAudio.sfxBrickBreak();
        this.collapseCol--;
        return;
      }

      if (this.collapseCol < b.bridgeStartCol) {
        if (!b.falling) {
          b.falling = true;
          b.vy = 0;
          window.RetroAudio.sfxBossDefeat();
          this._addScore(5000, b.x, b.y);
        }
        b.vy += 0.25;
        b.y += b.vy;
        if (b.y > VH + 30) {
          b.alive = false;
          this._startPrincessRescue();
        }
      }
    }

    _defeatBossDirectly() {
      const b = this.boss;
      this.runFinished = true;
      b.alive = false;
      this.bossFireballs = [];
      this._addScore(5000, b.x, b.y);
      this._addPopup("击败恶龙!", b.x, b.y - 10, "#FFE878");
      this._spawnBrickDebris(b.x, b.y);
      window.RetroAudio.sfxBossDefeat();
      this._startPrincessRescue();
    }

    _startPrincessRescue() {
      this.state = "princess_walk";
      this.stateTimer = 0;
      window.RetroAudio.sfxStageClear();
    }

    _updatePrincessWalk() {
      this.stateTimer++;
      const p = this.player;
      p.facingRight = true;
      const princess = this.npcs.find((n) => n.isPrincess);
      if (!princess) {
        this._finishStage4Victory();
        return;
      }
      princess.anim += 0.08;
      princess.facingRight = false;

      if (this.stateTimer % 18 === 0) {
        this.particles.push({
          type: "heart",
          x: princess.x + 4,
          y: princess.y - 6,
          vy: -0.6,
          life: 36
        });
      }

      if (princess.x > Math.max(153 * T, p.x + 22)) {
        princess.x -= 0.75;
      } else if (this.stateTimer > 65) {
        this._openDialogue(princess, true);
      }
    }

    _finishStage4Victory() {
      this.state = "victory";
      this.stateTimer = 0;
      this._spawnFirework();
      const route = this.usedShortcut ? "密道捷径" : "常规通关";
      if (this.callbacks.onVictory) {
        this.callbacks.onVictory({
          stage: 4,
          fullCampaign: this.campaignStartStage === 1,
          timeMs: this.runElapsedMs,
          score: this.score,
          coins: this.coins,
          route
        });
      }
    }

    _checkBonusCoins() {
      const p = this.player;
      for (const [c, r] of (this.level.bonusCoins || [])) {
        const key = `${this.zone}:${c},${r}`;
        if (this.collectedBonusCoins.has(key)) continue;
        const coinBox = { x: c * T + 2, y: r * T + 2, w: 12, h: 12 };
        if (this._rectsOverlap(p, coinBox)) {
          this.collectedBonusCoins.add(key);
          this._collectCoin(c * T + 8, r * T, true);
        }
      }
    }

    _collectCoin(px, py, direct = false) {
      this.coins++;
      this._addScore(200, px - 4, py - 8);
      window.RetroAudio.sfxCoin();
      if (!direct) {
        this.particles.push({
          type: "popCoin",
          x: px - 6,
          y: py - 12,
          vy: -3.2,
          life: 24
        });
      }
    }

    _beginWarp(wp) {
      this.state = "warping";
      this.stateTimer = 0;
      this.warpInfo = wp;
      window.RetroAudio.sfxPipe();
    }

    _updateWarp() {
      this.stateTimer++;
      if (this.stateTimer < 22) {
        this.player.y += 1;
        return;
      }
      if (this.stateTimer === 22) {
        const target = this.warpInfo.target;
        const wasBig = this.player.isBig;
        const star = this.player.starTimer;
        if (target === "underground") {
          this.usedShortcut = true;
          this._initZoneEntities("underground");
          this.player = this._createPlayer(this.level.spawn.x, this.level.spawn.y, wasBig);
          this.player.starTimer = star;
          this.cameraX = 0;
          window.RetroAudio.startBgm("underground");
        } else {
          this._initZoneEntities("overworld");
          const dest = this.level.exitSpawn;
          this.player = this._createPlayer(dest.x, dest.y, wasBig);
          this.player.starTimer = star;
          this.cameraX = Math.max(0, dest.x - VW * 0.35);
          window.RetroAudio.startBgm(star > 0 ? "star" : (this.level.bgm || "overworld"));
        }
        this.state = "playing";
      }
    }

    _triggerDeath() {
      this.state = "dying";
      this.stateTimer = 0;
      this.lives--;
      this.player.vx = 0;
      this.player.vy = -4.5;
      window.RetroAudio.sfxDie();
      this._emitHud();
    }

    _updateDying() {
      this.stateTimer++;
      if (this.stateTimer > 12) {
        this.player.vy = Math.min(5.5, this.player.vy + 0.24);
        this.player.y += this.player.vy;
      }
      if (this.stateTimer >= 100) {
        // 如果是在第1关或者单独选关，原地重开当前关；全程速通第2~4关阵亡也快速重开当前关继续挑战
        const keepTotal = this.campaignStartStage === 1 && this.currentStage > 1;
        this.startStage(this.currentStage, { keepProgress: keepTotal, autoUnpause: true });
      }
    }

    _triggerFlagpole() {
      if (this.runFinished) return;
      this.runFinished = true;
      this.state = "flag_slide";
      this.stateTimer = 0;

      const p = this.player;
      p.x = this.level.flagCol * T + 2;
      p.vx = 0;
      p.vy = 0;

      const heightRatio = Math.max(0, Math.min(1, (12 * T - p.y) / (9 * T)));
      const flagPts = heightRatio > 0.8 ? 5000 : heightRatio > 0.5 ? 2000 : heightRatio > 0.25 ? 800 : 400;
      this._addScore(flagPts, p.x, p.y - 8);
      window.RetroAudio.sfxFlagpole();
      this._emitHud();
    }

    _updateFlagSlide() {
      const p = this.player;
      const groundY = 12 * T - p.h;
      const flagBottomY = 11 * T;

      if (p.y < groundY) p.y = Math.min(groundY, p.y + 2.2);
      if (this.flagY < flagBottomY) this.flagY = Math.min(flagBottomY, this.flagY + 2.2);

      if (p.y >= groundY && this.flagY >= flagBottomY) {
        this.state = "castle_walk";
        this.stateTimer = 0;
        p.facingRight = true;
        window.RetroAudio.sfxStageClear();
      }
    }

    _updateCastleWalk() {
      const p = this.player;
      const doorX = (this.level.castleCol + 2) * T;
      p.walkAnim += 0.22;
      if (p.x < doorX) {
        p.x += 1.25;
      } else {
        this.state = "victory";
        this.stateTimer = 0;
        const route = this.usedShortcut ? "密道捷径" : "常规通关";
        const payload = {
          stage: this.currentStage,
          fullCampaign: this.campaignStartStage === 1,
          timeMs: this.runElapsedMs,
          score: this.score,
          coins: this.coins,
          route
        };
        if (this.currentStage < 4 && this.callbacks.onStageClear) {
          this.callbacks.onStageClear(payload);
        } else if (this.callbacks.onVictory) {
          this.callbacks.onVictory(payload);
        }
      }
    }

    _updateCamera() {
      if (this.zone === "underground") {
        this.cameraX = 0;
        return;
      }
      const target = this.player.x - VW * 0.42;
      const maxCam = this.level.cols * T - VW;
      if (target > this.cameraX) {
        this.cameraX = Math.min(maxCam, target);
      }
    }

    _spawnBrickDebris(x, y) {
      const dirs = [[-1.4, -3.6], [1.4, -3.6], [-1.0, -2.3], [1.0, -2.3]];
      dirs.forEach(([vx, vy]) => {
        this.particles.push({ type: "brick", x: x + 4, y: y + 4, vx, vy, life: 45 });
      });
    }

    _spawnFirework() {
      const baseCol = this.level.castleCol ? this.level.castleCol + 1 : 155;
      const cx = (baseCol + Math.random() * 4) * T;
      const cy = (2 + Math.random() * 4) * T;
      const colors = ["#FFE848", "#FF5252", "#58F0FF", "#88FF66"];
      const col = colors[Math.floor(Math.random() * colors.length)];
      window.RetroAudio.sfxFirework();
      for (let a = 0; a < 12; a++) {
        const rad = (Math.PI * 2 * a) / 12;
        this.particles.push({
          type: "spark",
          x: cx,
          y: cy,
          vx: Math.cos(rad) * 1.9,
          vy: Math.sin(rad) * 1.9,
          color: col,
          life: 28
        });
      }
    }

    _updateParticles() {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life--;
        if (pt.type === "popCoin") {
          pt.y += pt.vy;
          pt.vy += 0.25;
        } else if (pt.type === "brick") {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vy += 0.22;
        } else if (pt.type === "spark") {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vx *= 0.96;
          pt.vy *= 0.96;
        } else if (pt.type === "heart") {
          pt.y += pt.vy;
        }
        if (pt.life <= 0) this.particles.splice(i, 1);
      }
    }

    _addScore(pts, x, y) {
      this.score += pts;
      this._addPopup("+" + pts, x, y, "#FFFFFF");
    }

    _addPopup(text, x, y, color = "#FFFFFF") {
      this.popups.push({ text, x, y, color, life: 36 });
    }

    _updatePopups() {
      for (let i = this.popups.length - 1; i >= 0; i--) {
        const pop = this.popups[i];
        pop.y -= 0.45;
        pop.life--;
        if (pop.life <= 0) this.popups.splice(i, 1);
      }
    }

    _rectsOverlap(a, b) {
      return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    _emitHud() {
      if (this.callbacks.onHudUpdate) {
        this.callbacks.onHudUpdate({
          stage: this.currentStage,
          score: this.score,
          coins: this.coins,
          timeMs: this.runElapsedMs,
          runStarted: this.runStarted,
          runFinished: this.runFinished,
          zone: this.zone,
          isBig: this.player.isBig
        });
      }
    }

    // ============ 像素渲染 ============

    render() {
      const ctx = this.ctx;
      const theme = this.level.theme || "overworld";

      if (theme === "underground") ctx.fillStyle = "#080C1C";
      else if (theme === "highland") ctx.fillStyle = "#3A58A6";
      else if (theme === "castle") ctx.fillStyle = "#160A10";
      else ctx.fillStyle = "#6B8CFF";
      ctx.fillRect(0, 0, VW, VH);

      const camX = Math.floor(this.cameraX);
      ctx.save();
      ctx.translate(-camX, 0);

      this._drawScenery(ctx, camX, theme);
      if (this.level.flagCol) {
        this._drawFlagpoleAndCastle(ctx);
      }
      if (this.zone === "underground") {
        this._drawUndergroundLabels(ctx);
      }

      this._drawTiles(ctx, camX);
      this._drawBonusCoins(ctx);
      this._drawNpcs(ctx);
      this._drawBossAndAxe(ctx);
      this._drawEntities(ctx);
      this._drawEnemies(ctx);
      this._drawHazards(ctx);

      if (this.state !== "victory" || this.currentStage === 4) {
        if (!(this.state === "victory" && this.currentStage < 4)) {
          this._drawPlayer(ctx);
        }
      }

      this._drawParticles(ctx);
      this._drawPopups(ctx);

      ctx.restore();
    }

    _drawScenery(ctx, camX, theme) {
      const sc = this.level.scenery || {};
      if (theme === "highland") {
        // 远景暮色山峰
        for (let mx = Math.floor(camX / 120) * 120 - 120; mx < camX + VW + 120; mx += 120) {
          ctx.fillStyle = "#2A4284";
          ctx.fillRect(mx + 12, 165, 80, 75);
          ctx.fillRect(mx + 28, 140, 48, 25);
          ctx.fillRect(mx + 42, 124, 20, 16);
        }
      }

      for (const hx of (sc.hills || [])) {
        const px = hx * T;
        if (px + 80 < camX || px > camX + VW) continue;
        this._drawPixelHill(ctx, px, 13 * T);
      }
      for (const bx of (sc.bushes || [])) {
        const px = bx * T;
        if (px + 48 < camX || px > camX + VW) continue;
        this._drawPixelBush(ctx, px, 13 * T);
      }
      for (const cl of (sc.clouds || [])) {
        const px = cl.x * T;
        if (px + 64 < camX || px > camX + VW) continue;
        this._drawPixelCloud(ctx, px, cl.y * T + 4, cl.w);
      }
      for (const tx of (sc.torches || [])) {
        const px = tx * T;
        if (px + 16 < camX || px > camX + VW) continue;
        this._drawWallTorch(ctx, px, 6 * T);
      }
    }

    _drawWallTorch(ctx, x, y) {
      const flicker = Math.floor(this.tickCount / 6) % 2;
      ctx.fillStyle = "#5A3818";
      ctx.fillRect(x + 6, y + 6, 4, 12);
      ctx.fillStyle = flicker === 0 ? "#FF7818" : "#FF4810";
      ctx.fillRect(x + 5, y + 1, 6, 6);
      ctx.fillStyle = "#FFE858";
      ctx.fillRect(x + 6, y + 2 + flicker, 4, 4);
    }

    _drawPixelHill(ctx, x, baseY) {
      ctx.fillStyle = "#1C9828";
      ctx.fillRect(x + 8, baseY - 16, 48, 16);
      ctx.fillRect(x + 16, baseY - 28, 32, 12);
      ctx.fillRect(x + 24, baseY - 34, 16, 6);
      ctx.fillStyle = "#48C848";
      ctx.fillRect(x + 26, baseY - 30, 4, 4);
      ctx.fillRect(x + 18, baseY - 18, 4, 4);
      ctx.fillRect(x + 38, baseY - 12, 4, 4);
    }

    _drawPixelBush(ctx, x, baseY) {
      ctx.fillStyle = "#58D848";
      ctx.fillRect(x + 2, baseY - 10, 32, 10);
      ctx.fillRect(x + 8, baseY - 15, 20, 5);
      ctx.fillStyle = "#289820";
      ctx.fillRect(x + 6, baseY - 6, 4, 3);
      ctx.fillRect(x + 22, baseY - 8, 4, 3);
    }

    _drawPixelCloud(ctx, x, y, span) {
      const w = 24 + span * 12;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(x + 4, y + 6, w, 12);
      ctx.fillRect(x + 8, y + 2, w - 8, 4);
      ctx.fillRect(x, y + 10, w + 8, 6);
      ctx.fillStyle = "#B8D4FF";
      ctx.fillRect(x + 2, y + 16, w + 4, 2);
      ctx.fillStyle = "#3A5498";
      ctx.fillRect(x + 12, y + 9, 2, 3);
      ctx.fillRect(x + 18, y + 9, 2, 3);
    }

    _drawUndergroundLabels(ctx) {
      ctx.fillStyle = "#78D8FF";
      ctx.font = "bold 9px monospace";
      ctx.fillText("SECRET MILK ROOM!", 88, 22);
      ctx.fillStyle = "#FFE878";
      ctx.fillText("EXIT ->", 295, 168);
    }

    _drawTiles(ctx, camX) {
      const startC = Math.max(0, Math.floor(camX / T));
      const endC = Math.min(this.level.cols - 1, Math.ceil((camX + VW) / T));
      const qFrame = Math.floor(this.tickCount / 12) % 3;
      const lavaFrame = Math.floor(this.tickCount / 16) % 2;
      const isUnder = this.level.theme === "underground";

      for (let r = 0; r < this.level.rows; r++) {
        for (let c = startC; c <= endC; c++) {
          const tile = this.level.grid[r][c];
          if (tile === ".") continue;
          const meta = this.level.blockMeta[`${c},${r}`];
          if (meta && meta.hidden) continue;

          const bump = this.tileBumps.get(`${c},${r}`);
          const dy = bump ? Math.round(bump.off) : 0;
          const x = c * T;
          const y = r * T + dy;

          let spr = null;
          if (tile === "G") spr = isUnder ? window.SpriteBank.tiles.groundUnder : window.SpriteBank.tiles.ground;
          else if (tile === "B") spr = isUnder ? window.SpriteBank.tiles.brickUnder : window.SpriteBank.tiles.brick;
          else if (tile === "Q") spr = window.SpriteBank.tiles.question[qFrame];
          else if (tile === "U") spr = window.SpriteBank.tiles.used;
          else if (tile === "H") spr = window.SpriteBank.tiles.hard;
          else if (tile === "PTL") spr = window.SpriteBank.tiles.pipeTopL;
          else if (tile === "PTR") spr = window.SpriteBank.tiles.pipeTopR;
          else if (tile === "PBL") spr = window.SpriteBank.tiles.pipeBodyL;
          else if (tile === "PBR") spr = window.SpriteBank.tiles.pipeBodyR;
          else if (tile === "TTL") spr = window.SpriteBank.tiles.treeTopL;
          else if (tile === "TTM") spr = window.SpriteBank.tiles.treeTopM;
          else if (tile === "TTR") spr = window.SpriteBank.tiles.treeTopR;
          else if (tile === "TRK") spr = window.SpriteBank.tiles.treeTrunk;
          else if (tile === "C") spr = window.SpriteBank.tiles.castleStone;
          else if (tile === "BRG") spr = window.SpriteBank.tiles.bridge;
          else if (tile === "LV") spr = window.SpriteBank.tiles["lava" + lavaFrame];
          else if (tile === "LB") spr = window.SpriteBank.tiles.lavaBody;

          if (spr) ctx.drawImage(spr, x, y);
        }
      }

      if (this.zone !== "underground" && this.level.warpPipes) {
        for (const wp of this.level.warpPipes) {
          if (wp.hint && Math.floor(this.tickCount / 20) % 2 === 0) {
            ctx.fillStyle = "#FFE878";
            ctx.font = "bold 8px monospace";
            ctx.fillText(wp.hint, wp.col * T - 6, wp.topRow * T - 4);
          }
        }
      }
    }

    _drawFlagpoleAndCastle(ctx) {
      const fx = this.level.flagCol * T + 7;
      ctx.fillStyle = "#D8E8D8";
      ctx.fillRect(fx, 3 * T, 2, 9 * T);
      ctx.fillStyle = "#50D040";
      ctx.fillRect(fx - 2, 3 * T - 4, 6, 6);

      const fy = Math.round(this.flagY);
      ctx.fillStyle = "#FF4848";
      ctx.fillRect(fx - 14, fy, 14, 10);
      ctx.fillStyle = "#FCCE38";
      ctx.fillRect(fx - 10, fy + 2, 6, 6);

      const cx = this.level.castleCol * T;
      const cy = 8 * T;
      ctx.fillStyle = "#C85828";
      ctx.fillRect(cx, cy + 16, 80, 64);
      ctx.fillRect(cx + 16, cy, 48, 16);
      for (let i = 0; i < 5; i++) ctx.fillRect(cx + i * 16 + 2, cy + 10, 10, 6);
      for (let i = 0; i < 3; i++) ctx.fillRect(cx + 18 + i * 16, cy - 6, 10, 6);
      ctx.fillStyle = "#18100C";
      ctx.fillRect(cx + 32, cy + 52, 16, 28);
      ctx.fillRect(cx + 34, cy + 48, 12, 4);
      ctx.fillRect(cx + 22, cy + 26, 8, 12);
      ctx.fillRect(cx + 50, cy + 26, 8, 12);
      if (this.state === "victory") {
        ctx.fillStyle = "#FFE848";
        ctx.fillRect(cx + 39, cy - 22, 2, 16);
        ctx.fillStyle = "#48E058";
        ctx.fillRect(cx + 41, cy - 22, 12, 8);
      }
    }

    _drawNpcs(ctx) {
      for (const npc of this.npcs) {
        const frames = window.SpriteBank.npcs[npc.type];
        if (!frames) continue;
        const fIdx = Math.floor(npc.anim) % frames.length;
        const spr = frames[fIdx];
        const x = Math.round(npc.x);
        const y = Math.round(npc.y);

        ctx.save();
        if (npc.facingRight) {
          ctx.translate(x + spr.width, y);
          ctx.scale(-1, 1);
          ctx.drawImage(spr, 0, 0);
        } else {
          ctx.drawImage(spr, x, y);
        }
        ctx.restore();

        // 1-4 公主在恶龙未倒下前呼救
        if (npc.isPrincess && this.boss && this.boss.alive) {
          if (Math.floor(this.tickCount / 22) % 2 === 0) {
            ctx.fillStyle = "#FF98C8";
            ctx.font = "bold 8px monospace";
            ctx.fillText("HELP!", x - 4, y - 4);
          }
          continue;
        }

        // 玩家靠近且未在对话中时显示交互气泡
        if (this.nearbyNpc === npc && !this.dialogueState) {
          const bob = Math.floor(this.tickCount / 14) % 2;
          ctx.fillStyle = "#14182E";
          ctx.fillRect(x - 10, y - 14 + bob, 36, 11);
          ctx.strokeStyle = "#FCCE38";
          ctx.lineWidth = 1;
          ctx.strokeRect(x - 10.5, y - 14.5 + bob, 37, 12);
          ctx.fillStyle = "#FFE878";
          ctx.font = "bold 7px monospace";
          ctx.fillText("[E] TALK", x - 8, y - 6 + bob);
        }
      }
    }

    _drawBossAndAxe(ctx) {
      const b = this.boss;
      if (!b) return;

      if (!this.axeCollected) {
        const bob = Math.floor(this.tickCount / 12) % 2;
        ctx.drawImage(window.SpriteBank.items.axe, b.axeCol * T, b.axeRow * T + bob);
      }

      if (b.alive) {
        if (b.flashTimer > 0 && Math.floor(this.tickCount / 2) % 2 === 0) return;
        const f = (Math.floor(b.anim) % 2) + 1;
        const key = (b.vx >= 0 ? "r" : "l") + f;
        const spr = window.SpriteBank.dragon[key];
        ctx.drawImage(spr, Math.round(b.x) - 2, Math.round(b.y) - 2);
      }
    }

    _drawHazards(ctx) {
      const fbSpr = window.SpriteBank.items.fireball;
      for (const fb of this.fireballs) {
        if (fb.baseY - fb.y > 4) {
          ctx.drawImage(fbSpr, Math.round(fb.x), Math.round(fb.y));
        }
      }
      for (const bf of this.bossFireballs) {
        ctx.drawImage(fbSpr, Math.round(bf.x), Math.round(bf.y));
      }
    }

    _drawBonusCoins(ctx) {
      const frame = Math.floor(this.tickCount / 7) % 4;
      const spr = window.SpriteBank.items.coins[frame];
      for (const [c, r] of (this.level.bonusCoins || [])) {
        const key = `${this.zone}:${c},${r}`;
        if (this.collectedBonusCoins.has(key)) continue;
        ctx.drawImage(spr, c * T + 1, r * T + 1);
      }
    }

    _drawEntities(ctx) {
      for (const it of this.entities) {
        let spr = window.SpriteBank.items.milk;
        if (it.type === "greenMilk") spr = window.SpriteBank.items.greenMilk;
        else if (it.type === "star") spr = window.SpriteBank.items.star;
        ctx.drawImage(spr, Math.round(it.x), Math.round(it.y));
      }
    }

    _drawEnemies(ctx) {
      for (const e of this.enemies) {
        if (!e.active) continue;
        const x = Math.round(e.x);
        const y = Math.round(e.y);
        if (e.type === "goomba") {
          let spr = window.SpriteBank.goomba[Math.floor(e.anim) % 2];
          if (e.state === "squashed") spr = window.SpriteBank.goomba[2];
          ctx.drawImage(spr, x - 1, y - 2);
        } else if (e.type === "koopa") {
          if (e.state === "shell" || e.state === "shell_slide") {
            ctx.drawImage(window.SpriteBank.koopa.shell, x - 1, y);
          } else {
            const f = (Math.floor(e.anim) % 2) + 1;
            const key = (e.vx >= 0 ? "r" : "l") + f;
            ctx.drawImage(window.SpriteBank.koopa[key], x - 1, y);
          }
        }
      }
    }

    _drawPlayer(ctx) {
      const p = this.player;
      if (p.invulnTimer > 0 && Math.floor(this.tickCount / 3) % 2 === 0 && this.state === "playing") {
        return;
      }

      let pose = "idle";
      if (this.state === "dying") {
        pose = "hurt";
      } else if (!p.onGround) {
        pose = "jump";
      } else if ((this.input.left && p.vx > 0.4) || (this.input.right && p.vx < -0.4)) {
        pose = "skid";
      } else if (Math.abs(p.vx) > 0.15) {
        pose = Math.floor(p.walkAnim) % 2 === 0 ? "walk1" : "walk2";
      }

      const starIdx = p.starTimer > 0 ? Math.floor(this.tickCount / 3) % 3 : -1;
      const spr = window.SpriteBank.getNaiwaFrame(pose, p.facingRight, p.isBig, starIdx);
      const drawX = Math.round(p.x - (spr.width - p.w) / 2);
      const drawY = Math.round(p.y - (spr.height - p.h));
      ctx.drawImage(spr, drawX, drawY);
    }

    _drawParticles(ctx) {
      const coinFrame = Math.floor(this.tickCount / 4) % 4;
      for (const pt of this.particles) {
        if (pt.type === "popCoin") {
          ctx.drawImage(window.SpriteBank.items.coins[coinFrame], Math.round(pt.x), Math.round(pt.y));
        } else if (pt.type === "brick") {
          ctx.fillStyle = "#C84C1C";
          ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 6, 6);
          ctx.fillStyle = "#F09860";
          ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 3, 2);
        } else if (pt.type === "spark") {
          ctx.fillStyle = pt.color;
          ctx.fillRect(Math.round(pt.x), Math.round(pt.y), 3, 3);
        } else if (pt.type === "heart") {
          ctx.drawImage(window.SpriteBank.items.heart, Math.round(pt.x), Math.round(pt.y));
        }
      }
    }

    _drawPopups(ctx) {
      ctx.font = "bold 8px monospace";
      for (const pop of this.popups) {
        ctx.fillStyle = "#000000";
        ctx.fillText(pop.text, Math.round(pop.x) + 1, Math.round(pop.y) + 1);
        ctx.fillStyle = pop.color;
        ctx.fillText(pop.text, Math.round(pop.x), Math.round(pop.y));
      }
    }
  }

  window.NaiwaGame = NaiwaGame;
})();
