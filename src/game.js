/**
 * 《奶娃之旅》核心游戏引擎 (60fps 固定步长物理 + 超级马里奥 1-1 玩法)
 * 作者: forgivez
 */
(function () {
  const CFG = window.NAIWA_CONFIG;
  const T = CFG.TILE_SIZE; // 16
  const VW = CFG.VIEW_WIDTH; // 400
  const VH = CFG.VIEW_HEIGHT; // 240
  const SOLID = window.NaiwaLevels.TILE_SOLID;

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

      this.paused = true; // 打开时先展示作者弹窗
      this.modalOpen = true;
      this.rafId = null;
      this.lastFrameTime = 0;
      this.accumulator = 0;
      this.tickCount = 0;

      this.resetGameState();
      this._bindInput();
    }

    resetGameState(autoUnpause = false) {
      this.levels = window.NaiwaLevels.createLevelState();
      this.zone = "overworld";
      this.level = this.levels.overworld;

      this.score = 0;
      this.coins = 0;
      this.lives = 3;
      this.usedShortcut = false;

      // 速通计时器 (首次按键开始计时，碰旗杆瞬间锁表)
      this.runStarted = false;
      this.runFinished = false;
      this.runElapsedMs = 0;

      this.cameraX = 0;
      this.state = "playing"; // 'playing' | 'warping' | 'dying' | 'flag_slide' | 'castle_walk' | 'victory'
      this.stateTimer = 0;
      this.warpInfo = null;

      this.entities = []; // 活跃道具
      this.enemies = [];
      this.particles = [];
      this.popups = [];
      this.tileBumps = new Map(); // "c,r" -> offsetY
      this.collectedBonusCoins = new Set();

      this._initZoneEntities("overworld");

      this.player = this._createPlayer(this.level.spawn.x, this.level.spawn.y);
      this.flagY = 3 * T; // 旗帜当前高度

      if (autoUnpause) {
        this.paused = false;
        this.modalOpen = false;
        window.RetroAudio.startBgm("overworld");
      }

      this._emitHud();
    }

    _createPlayer(x, y, preservePower = false) {
      const prevBig = preservePower && this.player ? this.player.isBig : false;
      return {
        x,
        y,
        vx: 0,
        vy: 0,
        w: 12,
        h: prevBig ? 24 : 20,
        facingRight: true,
        onGround: false,
        coyoteTimer: 0,
        isBig: prevBig,
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
      this.tileBumps.clear();
      this.enemies = lv.enemies.map((e) => ({
        type: e.type,
        x: e.x,
        y: e.y,
        vx: -0.65,
        vy: 0,
        w: 14,
        h: e.type === "koopa" ? 18 : 14,
        active: false,
        state: "walk", // 'walk' | 'squashed' | 'shell' | 'shell_slide' | 'flipped'
        timer: 0,
        anim: 0
      }));
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
          : (this.zone === "underground" ? "underground" : "overworld");
        window.RetroAudio.startBgm(track);
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
        "KeyR", "KeyP", "Escape"
      ]);
      const JUMP_CODES = new Set(["ArrowUp", "KeyW", "Space", "KeyZ", "KeyK", "Numpad8"]);

      const onKeyDown = (e) => {
        if (this.modalOpen) return;
        const tag = (e.target && e.target.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        const code = this._resolveControlCode(e);
        if (!GAME_CODES.has(code)) return;

        // 阻止浏览器滚动、按钮空格触发以及中文输入法拦截组合键
        e.preventDefault();

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

      // 速通计时推进
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

      // 更新砖块撞击弹跳动画
      this.tileBumps.forEach((val, key) => {
        val.vel += 0.35;
        val.off += val.vel;
        if (val.off >= 0) {
          this.tileBumps.delete(key);
        }
      });

      this._updateParticles();
      this._updatePopups();

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
      this._checkBonusCoins();
      this._updateCamera();
      this._emitHud();
    }

    _updatePlayer() {
      const p = this.player;
      if (this.input.jumpPressedBuffer > 0) this.input.jumpPressedBuffer--;
      if (p.invulnTimer > 0) p.invulnTimer--;

      if (p.starTimer > 0) {
        p.starTimer--;
        if (p.starTimer === 0) {
          window.RetroAudio.startBgm(this.zone === "underground" ? "underground" : "overworld");
        }
      }

      // 水平速度与马里奥惯性手感
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

      // 跳跃判定 (带土狼时间与输入缓冲)
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

      // 可变跳高重力
      const grav = p.vy < 0 && this.input.jumpHeld ? 0.155 : 0.34;
      p.vy = Math.min(5.2, p.vy + grav);

      // 水平移动与碰撞
      p.x += p.vx;
      if (p.x < this.cameraX) {
        p.x = this.cameraX;
        if (p.vx < 0) p.vx = 0;
      }
      if (p.x + p.w > this.level.cols * T) {
        p.x = this.level.cols * T - p.w;
      }
      this._resolveHorizontal(p);

      // 垂直移动与碰撞
      p.y += p.vy;
      const hitHead = this._resolveVertical(p);
      if (hitHead) {
        this._handleHeadBump(hitHead.c, hitHead.r);
      }

      // 走路动画计数
      if (p.onGround && Math.abs(p.vx) > 0.15) {
        p.walkAnim += Math.abs(p.vx) * 0.16;
      } else {
        p.walkAnim = 0;
      }

      // 检查是否站在可进入的传送水管上
      if (p.onGround) {
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

      // 检查掉入深坑
      if (p.y > VH + 16) {
        this._triggerDeath();
        return;
      }

      // 检查是否触碰终点旗杆
      if (this.zone === "overworld" && p.x + p.w >= this.level.flagCol * T + 5) {
        this._triggerFlagpole();
      }
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
      // 隐藏砖块在被顶出来之前对水平/下落不阻挡（仅支持从下方顶出）
      if (meta && meta.hidden) return false;
      return true;
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
        const bottom = Math.floor((ent.y + ent.h) / T);
        ent.onGround = false;
        for (let c = left; c <= right; c++) {
          if (this._isSolidAt(c, bottom)) {
            ent.y = bottom * T - ent.h;
            ent.vy = 0;
            ent.onGround = true;
            return null;
          }
        }
      } else {
        const top = Math.floor(ent.y / T);
        // 先检查是否顶到隐藏砖块
        for (let c = left; c <= right; c++) {
          const tile = this._tileAt(c, top);
          const meta = this.level.blockMeta[`${c},${top}`];
          if (SOLID.has(tile) || (meta && meta.hidden)) {
            // 选取离玩家中心最近的方块触发撞击
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

      // 伤害正站在该方块上的敌人
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
          this.entities.push({
            type: "milk",
            x: c * T + 1,
            y: r * T - 14,
            vx: 0.9,
            vy: -1.5,
            w: 14,
            h: 14,
            emergeTimer: 14
          });
        } else if (meta.content === "star") {
          window.RetroAudio.sfxPowerupAppear();
          this.entities.push({
            type: "star",
            x: c * T + 1,
            y: r * T - 14,
            vx: 1.35,
            vy: -3.2,
            w: 14,
            h: 14,
            emergeTimer: 12
          });
        } else if (meta.content === "1up") {
          window.RetroAudio.sfxPowerupAppear();
          this.entities.push({
            type: "greenMilk",
            x: c * T + 1,
            y: r * T - 14,
            vx: 0.95,
            vy: -1.5,
            w: 14,
            h: 14,
            emergeTimer: 14
          });
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
          if (this._resolveVerticalSimple(it)) it.vy = -3.3; // 星星一路弹跳!
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

        // 与奶娃拾取检测
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
            p.starTimer = 540; // 9秒加速无敌!
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
        const bottom = Math.floor((ent.y + ent.h) / T);
        for (let c = left; c <= right; c++) {
          if (this._isSolidAt(c, bottom)) {
            ent.y = bottom * T - ent.h;
            ent.vy = 0;
            return true;
          }
        }
      }
      return false;
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

        // 滑动龟壳撞击其他敌人
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

        // 与奶娃碰撞判定
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
          } else if (p.invulnTimer <= 0) {
            if (p.isBig) {
              p.isBig = false;
              p.h = 20;
              p.y += 4;
              p.invulnTimer = 95;
              window.RetroAudio.sfxShrink();
              this._addPopup("护体失效!", p.x, p.y - 8, "#FF9060");
            } else {
              this._triggerDeath();
              return;
            }
          }
        }
      }
    }

    _checkBonusCoins() {
      const p = this.player;
      for (const [c, r] of this.level.bonusCoins) {
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
          this.player = this._createPlayer(this.level.spawn.x, this.level.spawn.y, true);
          this.player.isBig = wasBig;
          this.player.h = wasBig ? 24 : 20;
          this.player.starTimer = star;
          this.cameraX = 0;
          window.RetroAudio.startBgm("underground");
        } else {
          this._initZoneEntities("overworld");
          const dest = this.level.exitSpawn;
          this.player = this._createPlayer(dest.x, dest.y, true);
          this.player.isBig = wasBig;
          this.player.h = wasBig ? 24 : 20;
          this.player.starTimer = star;
          this.cameraX = Math.max(0, dest.x - VW * 0.35);
          window.RetroAudio.startBgm(star > 0 ? "star" : "overworld");
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
      if (this.stateTimer >= 105) {
        // 速通模式：直接无缝重开本关并重置计时器，随时冲击榜首！
        this.resetGameState(true);
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

      // 高度越高得分越多
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
        if (this.callbacks.onVictory) {
          this.callbacks.onVictory({
            timeMs: this.runElapsedMs,
            score: this.score,
            coins: this.coins,
            route
          });
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
        this.particles.push({
          type: "brick",
          x: x + 4,
          y: y + 4,
          vx,
          vy,
          life: 45
        });
      });
    }

    _spawnFirework() {
      const cx = (this.level.castleCol + 1 + Math.random() * 4) * T;
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
      return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      );
    }

    _emitHud() {
      if (this.callbacks.onHudUpdate) {
        this.callbacks.onHudUpdate({
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
      const isUnder = this.zone === "underground";

      // 天空 / 地下背景
      ctx.fillStyle = isUnder ? "#080C1C" : "#6B8CFF";
      ctx.fillRect(0, 0, VW, VH);

      const camX = Math.floor(this.cameraX);
      ctx.save();
      ctx.translate(-camX, 0);

      if (!isUnder) {
        this._drawScenery(ctx, camX);
        this._drawFlagpoleAndCastle(ctx);
      } else {
        this._drawUndergroundLabels(ctx);
      }

      this._drawTiles(ctx, camX);
      this._drawBonusCoins(ctx);
      this._drawEntities(ctx);
      this._drawEnemies(ctx);
      if (this.state !== "victory") {
        this._drawPlayer(ctx);
      }
      this._drawParticles(ctx);
      this._drawPopups(ctx);

      ctx.restore();
    }

    _drawScenery(ctx, camX) {
      const sc = this.level.scenery;
      // 远山
      for (const hx of sc.hills) {
        const px = hx * T;
        if (px + 80 < camX || px > camX + VW) continue;
        this._drawPixelHill(ctx, px, 13 * T);
      }
      // 灌木
      for (const bx of sc.bushes) {
        const px = bx * T;
        if (px + 48 < camX || px > camX + VW) continue;
        this._drawPixelBush(ctx, px, 13 * T);
      }
      // 像素笑脸云朵
      for (const cl of sc.clouds) {
        const px = cl.x * T;
        if (px + 64 < camX || px > camX + VW) continue;
        this._drawPixelCloud(ctx, px, cl.y * T + 4, cl.w);
      }
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
      // 可爱小豆眼
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
      const isUnder = this.zone === "underground";

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

          if (spr) ctx.drawImage(spr, x, y);
        }
      }

      // 在密道入口水管上闪烁提示
      if (!isUnder) {
        for (const wp of this.level.warpPipes) {
          if (wp.hint && Math.floor(this.tickCount / 20) % 2 === 0) {
            ctx.fillStyle = "#FFE878";
            ctx.font = "bold 8px monospace";
            ctx.fillText("↓ SECRET", wp.col * T - 6, wp.topRow * T - 4);
          }
        }
      }
    }

    _drawFlagpoleAndCastle(ctx) {
      const fx = this.level.flagCol * T + 7;
      // 旗杆柱与顶端圆球
      ctx.fillStyle = "#D8E8D8";
      ctx.fillRect(fx, 3 * T, 2, 9 * T);
      ctx.fillStyle = "#50D040";
      ctx.fillRect(fx - 2, 3 * T - 4, 6, 6);

      // 奶娃旗帜
      const fy = Math.round(this.flagY);
      ctx.fillStyle = "#FF4848";
      ctx.fillRect(fx - 14, fy, 14, 10);
      ctx.fillStyle = "#FCCE38";
      ctx.fillRect(fx - 10, fy + 2, 6, 6);

      // 终点像素城堡 (col 202..207)
      const cx = this.level.castleCol * T;
      const cy = 8 * T;
      ctx.fillStyle = "#C85828";
      ctx.fillRect(cx, cy + 16, 80, 64);
      ctx.fillRect(cx + 16, cy, 48, 16);
      // 城垛
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = "#C85828";
        ctx.fillRect(cx + i * 16 + 2, cy + 10, 10, 6);
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(cx + 18 + i * 16, cy - 6, 10, 6);
      }
      // 城堡拱门
      ctx.fillStyle = "#18100C";
      ctx.fillRect(cx + 32, cy + 52, 16, 28);
      ctx.fillRect(cx + 34, cy + 48, 12, 4);
      // 城堡小窗户
      ctx.fillRect(cx + 22, cy + 26, 8, 12);
      ctx.fillRect(cx + 50, cy + 26, 8, 12);
      // 城堡旗帜
      if (this.state === "victory") {
        ctx.fillStyle = "#FFE848";
        ctx.fillRect(cx + 39, cy - 22, 2, 16);
        ctx.fillStyle = "#48E058";
        ctx.fillRect(cx + 41, cy - 22, 12, 8);
      }
    }

    _drawBonusCoins(ctx) {
      const frame = Math.floor(this.tickCount / 7) % 4;
      const spr = window.SpriteBank.items.coins[frame];
      for (const [c, r] of this.level.bonusCoins) {
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
        return; // 无敌闪烁
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
