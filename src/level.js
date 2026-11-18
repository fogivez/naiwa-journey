/**
 * 《奶娃之旅》第一关关卡数据 (仿超级马里奥 World 1-1 经典布局)
 * 分辨率: 400x240, 方块大小: 16x16 (高 15 格, 地面为第 13~14 行)
 */
(function () {
  const T = 16;

  // 方块类型常量:
  // '.' 空, 'G' 地面, 'B' 砖块, 'Q' 问号方块, 'H' 硬石台阶, 'U' 已顶空块
  // 'PTL','PTR','PBL','PBR' 绿色水管
  const TILE_SOLID = new Set(["G", "B", "Q", "H", "U", "PTL", "PTR", "PBL", "PBR"]);

  function buildMainLevel() {
    const COLS = 214;
    const ROWS = 15;
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("."));

    // 特殊方块数据 key = "col,row" -> { content: 'coin'|'milk'|'star'|'1up'|'multicoin', hitsLeft, hidden }
    const blockMeta = {};
    const warpPipes = []; // { col, topRow, target: 'underground'|'overworld', destX, destY }

    const fillGround = (c1, c2) => {
      for (let c = c1; c <= c2; c++) {
        grid[13][c] = "G";
        grid[14][c] = "G";
      }
    };

    // 地面与经典的 1-1 三个深坑
    fillGround(0, 68);
    fillGround(71, 85);
    fillGround(89, 152);
    fillGround(155, 213);

    const setBlock = (c, r, type, meta = null) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        grid[r][c] = type;
        if (meta) blockMeta[`${c},${r}`] = { ...meta };
      }
    };

    const addPipe = (c, heightTiles, warpConfig = null) => {
      const topRow = 13 - heightTiles;
      setBlock(c, topRow, "PTL");
      setBlock(c + 1, topRow, "PTR");
      for (let r = topRow + 1; r < 13; r++) {
        setBlock(c, r, "PBL");
        setBlock(c + 1, r, "PBR");
      }
      if (warpConfig) {
        warpPipes.push({ col: c, topRow, ...warpConfig });
      }
    };

    // --- 第一段: 经典起手 砖块 + 问号 ---
    setBlock(16, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(20, 9, "B");
    setBlock(21, 9, "Q", { content: "milk", hitsLeft: 1 }); // 第一个魔法奶瓶！
    setBlock(22, 9, "B");
    setBlock(23, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(24, 9, "B");
    setBlock(22, 5, "Q", { content: "coin", hitsLeft: 1 });

    // --- 经典4根递增水管 (第4根可按 ↓ 进入秘密地下金币房跳关捷径!) ---
    addPipe(28, 2);
    addPipe(38, 3);
    addPipe(46, 4);
    addPipe(57, 4, { target: "underground", hint: "按 ↓ 进密道" });

    // 隐藏 1-UP 绿奶块
    setBlock(64, 8, "Q", { content: "1up", hitsLeft: 1, hidden: true });

    // --- 第二段: 高架砖桥 + 星星/金币 ---
    setBlock(77, 9, "B");
    setBlock(78, 9, "Q", { content: "milk", hitsLeft: 1 });
    setBlock(79, 9, "B");

    for (let c = 80; c <= 87; c++) setBlock(c, 5, "B");

    // 第三段多连砖块与问号
    for (let c = 91; c <= 93; c++) setBlock(c, 5, "B");
    setBlock(94, 5, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(94, 9, "B", { content: "multicoin", hitsLeft: 8 }); // 经典连顶金币砖！

    setBlock(100, 9, "B");
    setBlock(101, 9, "B", { content: "star", hitsLeft: 1 }); // 无敌加速星星！

    setBlock(106, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(109, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(109, 5, "Q", { content: "milk", hitsLeft: 1 });
    setBlock(112, 9, "Q", { content: "coin", hitsLeft: 1 });

    setBlock(118, 9, "B");
    for (let c = 121; c <= 123; c++) setBlock(c, 5, "B");

    setBlock(128, 5, "B");
    setBlock(129, 5, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(130, 5, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(131, 5, "B");
    setBlock(129, 9, "B");
    setBlock(130, 9, "B");

    // --- 第四段: 经典双金字塔台阶 ---
    // 上坡 134..137
    for (let i = 0; i < 4; i++) {
      for (let r = 12; r >= 12 - i; r--) setBlock(134 + i, r, "H");
    }
    // 下坡 140..143
    for (let i = 0; i < 4; i++) {
      for (let r = 12; r >= 9 + i; r--) setBlock(140 + i, r, "H");
    }

    // 跨坑台阶 148..152 & 155..158
    for (let i = 0; i < 4; i++) {
      for (let r = 12; r >= 12 - i; r--) setBlock(148 + i, r, "H");
    }
    for (let r = 12; r >= 9; r--) setBlock(152, r, "H");
    for (let i = 0; i < 4; i++) {
      for (let r = 12; r >= 9 + i; r--) setBlock(155 + i, r, "H");
    }

    // --- 密道出口水管 & 冲刺段 ---
    addPipe(163, 2);
    setBlock(168, 9, "B");
    setBlock(169, 9, "B");
    setBlock(170, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(171, 9, "B");
    addPipe(179, 2);

    // --- 终点前 8 层阶梯金字塔 ---
    for (let i = 0; i < 8; i++) {
      for (let r = 12; r >= 12 - i; r--) setBlock(181 + i, r, "H");
    }
    for (let r = 12; r >= 5; r--) setBlock(189, r, "H");

    // 旗杆底座
    setBlock(198, 12, "H");

    // 空中散落鼓励金币
    const bonusCoins = [
      [33, 9], [34, 8], [35, 9],
      [73, 10], [74, 9], [75, 10],
      [138, 7], [139, 7],
      [153, 7], [154, 7]
    ];

    // 敌人列表
    const enemies = [
      { type: "goomba", x: 22 * T, y: 12 * T },
      { type: "goomba", x: 41 * T, y: 12 * T },
      { type: "goomba", x: 51 * T, y: 12 * T },
      { type: "goomba", x: 53 * T, y: 12 * T },
      { type: "goomba", x: 80 * T, y: 4 * T },
      { type: "goomba", x: 82 * T, y: 4 * T },
      { type: "goomba", x: 97 * T, y: 12 * T },
      { type: "goomba", x: 99 * T, y: 12 * T },
      { type: "koopa",  x: 107 * T, y: 11 * T },
      { type: "goomba", x: 114 * T, y: 12 * T },
      { type: "goomba", x: 116 * T, y: 12 * T },
      { type: "goomba", x: 124 * T, y: 12 * T },
      { type: "goomba", x: 126 * T, y: 12 * T },
      { type: "goomba", x: 128 * T, y: 12 * T },
      { type: "goomba", x: 130 * T, y: 12 * T },
      { type: "goomba", x: 174 * T, y: 12 * T },
      { type: "goomba", x: 176 * T, y: 12 * T }
    ];

    // 背景装饰 (云朵, 小山丘, 灌木)
    const scenery = {
      hills: [0, 48, 96, 144, 192],
      bushes: [11, 24, 60, 72, 106, 120, 157, 168],
      clouds: [
        { x: 8, y: 2, w: 1 }, { x: 19, y: 1, w: 1 }, { x: 27, y: 2, w: 3 },
        { x: 36, y: 1, w: 2 }, { x: 56, y: 2, w: 1 }, { x: 67, y: 1, w: 1 },
        { x: 75, y: 2, w: 3 }, { x: 85, y: 1, w: 2 }, { x: 104, y: 2, w: 1 },
        { x: 115, y: 1, w: 1 }, { x: 124, y: 2, w: 3 }, { x: 140, y: 1, w: 2 },
        { x: 162, y: 2, w: 1 }, { x: 173, y: 1, w: 3 }, { x: 192, y: 2, w: 2 }
      ]
    };

    return {
      name: "overworld",
      cols: COLS,
      rows: ROWS,
      grid,
      blockMeta,
      warpPipes,
      bonusCoins,
      enemies,
      scenery,
      flagCol: 198,
      castleCol: 202,
      spawn: { x: 3 * T, y: 11 * T },
      exitSpawn: { x: 163.5 * T, y: 9 * T }
    };
  }

  function buildUndergroundLevel() {
    const COLS = 25;
    const ROWS = 15;
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill("."));

    // 地面与顶壁
    for (let c = 0; c < COLS; c++) {
      grid[13][c] = "G";
      grid[14][c] = "G";
    }
    for (let r = 0; r < 13; r++) grid[r][0] = "B";
    for (let c = 4; c <= 16; c++) grid[2][c] = "B";

    // 中央奖励砖块台
    for (let c = 5; c <= 14; c++) {
      grid[10][c] = "B";
      grid[11][c] = "B";
      grid[12][c] = "B";
    }

    // 出口水管 (靠近右侧，进入即返回地面 163 格)
    grid[11][21] = "PTL"; grid[11][22] = "PTR";
    grid[12][21] = "PBL"; grid[12][22] = "PBR";

    const bonusCoins = [];
    for (let c = 6; c <= 13; c++) bonusCoins.push([c, 8]);
    for (let c = 6; c <= 13; c++) bonusCoins.push([c, 6]);
    for (let c = 7; c <= 12; c++) bonusCoins.push([c, 4]);

    return {
      name: "underground",
      cols: COLS,
      rows: ROWS,
      grid,
      blockMeta: {},
      warpPipes: [{ col: 21, topRow: 11, target: "overworld", sideEnter: true }],
      bonusCoins,
      enemies: [],
      scenery: { hills: [], bushes: [], clouds: [] },
      spawn: { x: 2.2 * T, y: 3 * T }
    };
  }

  window.NaiwaLevels = {
    TILE_SOLID,
    createLevelState() {
      return {
        overworld: buildMainLevel(),
        underground: buildUndergroundLevel()
      };
    }
  };
})();
