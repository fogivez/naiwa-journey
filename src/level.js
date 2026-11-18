/**
 * 《奶娃之旅》全四关关卡与剧情 NPC 数据
 * 1-1 奶娃大草原 (含密道) -> 1-2 幽暗古矿洞 -> 1-3 迷雾天桥群岛 -> 1-4 恶龙熔岩城堡 (Boss战 + 救公主)
 */
(function () {
  const T = 16;

  // 完全实体方块: G 地面, B 砖块, Q 问号, H 硬石, U 空块, PTL/PTR/PBL/PBR 水管, C 城堡石砖, BRG 锁链桥
  const TILE_SOLID = new Set(["G", "B", "Q", "H", "U", "PTL", "PTR", "PBL", "PBR", "C", "BRG"]);
  // 单向平台 (可从下方穿上去并踩在上面): TTL/TTM/TTR 树冠天桥
  const TILE_PLATFORM = new Set(["TTL", "TTM", "TTR"]);
  // 致死岩浆: LV 岩浆表层, LB 岩浆深处
  const TILE_HAZARD = new Set(["LV", "LB"]);

  const STAGE_INFO = {
    1: { num: 1, code: "1-1", name: "奶娃大草原", theme: "overworld", bgm: "overworld" },
    2: { num: 2, code: "1-2", name: "幽暗古矿洞", theme: "underground", bgm: "underground" },
    3: { num: 3, code: "1-3", name: "迷雾天桥群岛", theme: "highland", bgm: "highland" },
    4: { num: 4, code: "1-4", name: "恶龙熔岩城堡", theme: "castle", bgm: "castle" }
  };

  function makeGrid(rows, cols) {
    return Array.from({ length: rows }, () => Array(cols).fill("."));
  }

  function addPipeHelper(grid, warpPipes, c, heightTiles, warpConfig = null) {
    const topRow = 13 - heightTiles;
    grid[topRow][c] = "PTL";
    grid[topRow][c + 1] = "PTR";
    for (let r = topRow + 1; r < 13; r++) {
      grid[r][c] = "PBL";
      grid[r][c + 1] = "PBR";
    }
    if (warpConfig) {
      warpPipes.push({ col: c, topRow, ...warpConfig });
    }
  }

  // ================= 第一关：1-1 奶娃大草原 =================
  function buildStage1Main() {
    const COLS = 214;
    const ROWS = 15;
    const grid = makeGrid(ROWS, COLS);
    const blockMeta = {};
    const warpPipes = [];

    const fillGround = (c1, c2) => {
      for (let c = c1; c <= c2; c++) {
        grid[13][c] = "G";
        grid[14][c] = "G";
      }
    };
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

    setBlock(16, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(20, 9, "B");
    setBlock(21, 9, "Q", { content: "milk", hitsLeft: 1 });
    setBlock(22, 9, "B");
    setBlock(23, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(24, 9, "B");
    setBlock(22, 5, "Q", { content: "coin", hitsLeft: 1 });

    addPipeHelper(grid, warpPipes, 28, 2);
    addPipeHelper(grid, warpPipes, 38, 3);
    addPipeHelper(grid, warpPipes, 46, 4);
    addPipeHelper(grid, warpPipes, 57, 4, { target: "underground", hint: "↓ SECRET" });

    setBlock(64, 8, "Q", { content: "1up", hitsLeft: 1, hidden: true });

    setBlock(77, 9, "B");
    setBlock(78, 9, "Q", { content: "milk", hitsLeft: 1 });
    setBlock(79, 9, "B");
    for (let c = 80; c <= 87; c++) setBlock(c, 5, "B");

    for (let c = 91; c <= 93; c++) setBlock(c, 5, "B");
    setBlock(94, 5, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(94, 9, "B", { content: "multicoin", hitsLeft: 8 });

    setBlock(100, 9, "B");
    setBlock(101, 9, "B", { content: "star", hitsLeft: 1 });

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

    for (let i = 0; i < 4; i++) for (let r = 12; r >= 12 - i; r--) setBlock(134 + i, r, "H");
    for (let i = 0; i < 4; i++) for (let r = 12; r >= 9 + i; r--) setBlock(140 + i, r, "H");
    for (let i = 0; i < 4; i++) for (let r = 12; r >= 12 - i; r--) setBlock(148 + i, r, "H");
    for (let r = 12; r >= 9; r--) setBlock(152, r, "H");
    for (let i = 0; i < 4; i++) for (let r = 12; r >= 9 + i; r--) setBlock(155 + i, r, "H");

    addPipeHelper(grid, warpPipes, 163, 2);
    setBlock(168, 9, "B");
    setBlock(169, 9, "B");
    setBlock(170, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(171, 9, "B");
    addPipeHelper(grid, warpPipes, 179, 2);

    for (let i = 0; i < 8; i++) for (let r = 12; r >= 12 - i; r--) setBlock(181 + i, r, "H");
    for (let r = 12; r >= 5; r--) setBlock(189, r, "H");
    setBlock(198, 12, "H");

    const bonusCoins = [
      [33, 9], [34, 8], [35, 9],
      [73, 10], [74, 9], [75, 10],
      [138, 7], [139, 7],
      [153, 7], [154, 7]
    ];

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

    const npcs = [
      {
        id: "s1-elder",
        type: "elder",
        name: "村长老爷爷",
        title: "青草村长老",
        x: 7 * T,
        y: 13 * T - 22,
        facingRight: false,
        lines: [
          "勇者奶娃！大事不好了！盘踞在火山城堡的「深渊红龙」刚才飞过青草村，把莉莉娅公主掳走了！",
          "想救回公主，必须依次闯过【奶娃大草原】、【幽暗古矿洞】、【迷雾天桥】并击败恶龙！",
          "小秘密：前方第 4 根绿色水管上按 ↓ 藏着先祖留下的秘密金币捷径哦！"
        ]
      },
      {
        id: "s1-knight",
        type: "knight",
        name: "草原守卫",
        title: "王国见习骑士",
        x: 192 * T,
        y: 13 * T - 22,
        facingRight: false,
        lines: [
          "真不愧是勇者奶娃！居然一口气冲过了草原阶梯！",
          "触碰前方的终点旗杆就能进入城堡密道，前往第二关「幽暗古矿洞」！"
        ]
      }
    ];

    return {
      name: "overworld",
      theme: "overworld",
      bgm: "overworld",
      cols: COLS,
      rows: ROWS,
      grid,
      blockMeta,
      warpPipes,
      bonusCoins,
      enemies,
      npcs,
      fireballs: [],
      scenery: {
        hills: [0, 48, 96, 144, 192],
        bushes: [11, 24, 60, 72, 106, 120, 157, 168],
        clouds: [
          { x: 8, y: 2, w: 1 }, { x: 19, y: 1, w: 1 }, { x: 27, y: 2, w: 3 },
          { x: 36, y: 1, w: 2 }, { x: 56, y: 2, w: 1 }, { x: 67, y: 1, w: 1 },
          { x: 75, y: 2, w: 3 }, { x: 85, y: 1, w: 2 }, { x: 104, y: 2, w: 1 },
          { x: 115, y: 1, w: 1 }, { x: 124, y: 2, w: 3 }, { x: 140, y: 1, w: 2 },
          { x: 162, y: 2, w: 1 }, { x: 173, y: 1, w: 3 }, { x: 192, y: 2, w: 2 }
        ]
      },
      flagCol: 198,
      castleCol: 202,
      spawn: { x: 2.5 * T, y: 11 * T },
      exitSpawn: { x: 163.5 * T, y: 9 * T }
    };
  }

  function buildStage1Underground() {
    const COLS = 25;
    const ROWS = 15;
    const grid = makeGrid(ROWS, COLS);
    for (let c = 0; c < COLS; c++) {
      grid[13][c] = "G";
      grid[14][c] = "G";
    }
    for (let r = 0; r < 13; r++) grid[r][0] = "B";
    for (let c = 4; c <= 16; c++) grid[2][c] = "B";
    for (let c = 5; c <= 14; c++) {
      grid[10][c] = "B";
      grid[11][c] = "B";
      grid[12][c] = "B";
    }
    grid[11][21] = "PTL"; grid[11][22] = "PTR";
    grid[12][21] = "PBL"; grid[12][22] = "PBR";

    const bonusCoins = [];
    for (let c = 6; c <= 13; c++) bonusCoins.push([c, 8]);
    for (let c = 6; c <= 13; c++) bonusCoins.push([c, 6]);
    for (let c = 7; c <= 12; c++) bonusCoins.push([c, 4]);

    return {
      name: "underground",
      theme: "underground",
      bgm: "underground",
      cols: COLS,
      rows: ROWS,
      grid,
      blockMeta: {},
      warpPipes: [{ col: 21, topRow: 11, target: "overworld", sideEnter: true }],
      bonusCoins,
      enemies: [],
      npcs: [],
      fireballs: [],
      scenery: { hills: [], bushes: [], clouds: [] },
      spawn: { x: 2.2 * T, y: 3 * T }
    };
  }

  // ================= 第二关：1-2 幽暗古矿洞 =================
  function buildStage2Main() {
    const COLS = 196;
    const ROWS = 15;
    const grid = makeGrid(ROWS, COLS);
    const blockMeta = {};
    const warpPipes = [];

    const fillGround = (c1, c2) => {
      for (let c = c1; c <= c2; c++) {
        grid[13][c] = "G";
        grid[14][c] = "G";
      }
    };
    fillGround(0, 48);
    fillGround(51, 80);
    fillGround(83, 126);
    fillGround(129, 195);

    const setBlock = (c, r, type, meta = null) => {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        grid[r][c] = type;
        if (meta) blockMeta[`${c},${r}`] = { ...meta };
      }
    };

    // 矿洞天花板 (留出起点、捷径口与终点天空)
    for (let c = 5; c <= 165; c++) {
      setBlock(c, 1, "B");
    }

    // 起点问号组 + 魔法奶瓶
    setBlock(12, 9, "Q", { content: "milk", hitsLeft: 1 });
    setBlock(13, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(14, 9, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(15, 9, "Q", { content: "coin", hitsLeft: 1 });

    // 台阶石块地形
    for (let i = 0; i < 3; i++) for (let r = 12; r >= 12 - i; r--) setBlock(19 + i, r, "H");
    setBlock(25, 11, "H");
    setBlock(26, 11, "H");
    setBlock(26, 12, "H");

    // 悬空砖平台与连顶金币
    for (let c = 31; c <= 38; c++) setBlock(c, 9, "B");
    setBlock(34, 5, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(35, 9, "B", { content: "multicoin", hitsLeft: 7 });

    // 矿洞水管阵
    addPipeHelper(grid, warpPipes, 43, 2);
    addPipeHelper(grid, warpPipes, 54, 3);
    addPipeHelper(grid, warpPipes, 64, 4);

    // 高低交错砖桥
    for (let c = 68; c <= 76; c++) setBlock(c, 8, "B");
    setBlock(72, 4, "Q", { content: "star", hitsLeft: 1 }); // 无敌加速星星!

    for (let c = 86; c <= 94; c++) setBlock(c, 9, "B");
    setBlock(89, 5, "Q", { content: "milk", hitsLeft: 1 });
    setBlock(90, 5, "Q", { content: "coin", hitsLeft: 1 });

    // 1-UP 隐藏惊喜块
    setBlock(99, 8, "Q", { content: "1up", hitsLeft: 1, hidden: true });

    // 诗人安全小石台附近装饰砖
    for (let c = 109; c <= 116; c++) setBlock(c, 8, "B");
    setBlock(112, 8, "Q", { content: "coin", hitsLeft: 1 });
    setBlock(113, 8, "Q", { content: "coin", hitsLeft: 1 });

    // 跨深谷跳台
    for (let r = 12; r >= 10; r--) setBlock(125, r, "H");
    for (let r = 12; r >= 10; r--) setBlock(130, r, "H");

    for (let c = 136; c <= 145; c++) setBlock(c, 9, "B");
    setBlock(140, 5, "Q", { content: "milk", hitsLeft: 1 });

    addPipeHelper(grid, warpPipes, 152, 3);

    // 出口阶梯与终点旗杆
    for (let i = 0; i < 6; i++) for (let r = 12; r >= 12 - i; r--) setBlock(162 + i, r, "H");
    for (let r = 12; r >= 7; r--) setBlock(168, r, "H");
    setBlock(180, 12, "H");

    const bonusCoins = [
      [25, 9], [26, 9],
      [49, 9], [50, 9],
      [60, 7], [61, 7], [62, 7],
      [81, 8], [82, 8],
      [127, 7], [128, 7],
      [148, 8], [149, 8], [150, 8]
    ];

    const enemies = [
      { type: "goomba", x: 16 * T, y: 12 * T },
      { type: "goomba", x: 33 * T, y: 8 * T },
      { type: "goomba", x: 36 * T, y: 8 * T },
      { type: "koopa",  x: 58 * T, y: 11 * T },
      { type: "goomba", x: 70 * T, y: 7 * T },
      { type: "goomba", x: 74 * T, y: 7 * T },
      { type: "goomba", x: 88 * T, y: 8 * T },
      { type: "koopa",  x: 92 * T, y: 11 * T },
      { type: "goomba", x: 111 * T, y: 7 * T },
      { type: "goomba", x: 114 * T, y: 7 * T },
      { type: "goomba", x: 138 * T, y: 8 * T },
      { type: "koopa",  x: 142 * T, y: 11 * T },
      { type: "goomba", x: 158 * T, y: 12 * T },
      { type: "goomba", x: 160 * T, y: 12 * T }
    ];

    const npcs = [
      {
        id: "s2-miner",
        type: "miner",
        name: "矮人矿工托尔",
        title: "古矿洞探险者",
        x: 6 * T,
        y: 13 * T - 22,
        facingRight: false,
        lines: [
          "欢迎来到幽暗古矿洞，勇者奶娃！恶龙的手下已经把守住了各条矿道。",
          "这里的地形高低错落，踩着前方的矿石台阶跃上砖桥，说不定能找到闪闪发光的【无敌加速星】！"
        ]
      },
      {
        id: "s2-bard",
        type: "bard",
        name: "吟游诗人诺亚",
        title: "流浪歌者",
        x: 103 * T,
        y: 13 * T - 22,
        facingRight: false,
        lines: [
          "♪ 勇敢的奶娃不怕黑，脚踢乌龟向前飞~ ♪",
          "咳咳，我正在为你的冒险谱写史诗《奶娃屠龙记》！再往前穿过洞口，就能登上「迷雾天桥群岛」了！"
        ]
      }
    ];

    return {
      name: "stage2",
      theme: "underground",
      bgm: "underground",
      cols: COLS,
      rows: ROWS,
      grid,
      blockMeta,
      warpPipes,
      bonusCoins,
      enemies,
      npcs,
      fireballs: [],
      scenery: {
        hills: [],
        bushes: [],
        clouds: [],
        torches: [10, 24, 40, 56, 72, 88, 106, 122, 138, 156, 174]
      },
      flagCol: 180,
      castleCol: 184,
      spawn: { x: 2.2 * T, y: 11 * T },
      exitSpawn: { x: 2.2 * T, y: 11 * T }
    };
  }

  // ================= 第三关：1-3 迷雾天桥群岛 =================
  function buildStage3Main() {
    const COLS = 186;
    const ROWS = 15;
    const grid = makeGrid(ROWS, COLS);
    const blockMeta = {};

    const fillGround = (c1, c2) => {
      for (let c = c1; c <= c2; c++) {
        grid[13][c] = "G";
        grid[14][c] = "G";
      }
    };

    // 起点悬崖 + 中间精灵岛 + 终点悬崖
    fillGround(0, 15);
    fillGround(65, 76);
    fillGround(160, 185);

    // 树冠单向天桥平台构造器
    const addTreePlatform = (c1, c2, topRow, withTrunk = true) => {
      for (let c = c1; c <= c2; c++) {
        grid[topRow][c] = c === c1 ? "TTL" : (c === c2 ? "TTR" : "TTM");
      }
      if (withTrunk) {
        const mid = Math.floor((c1 + c2) / 2);
        for (let r = topRow + 1; r < ROWS; r++) {
          grid[r][mid] = "TRK";
        }
      }
    };

    // 连续起伏的空中天桥 (最大跳跃间隙不超过 3~4 格，非常顺手!)
    addTreePlatform(18, 25, 11);
    addTreePlatform(27, 34, 8);
    addTreePlatform(36, 44, 10);
    addTreePlatform(40, 46, 6);
    addTreePlatform(48, 55, 9);
    addTreePlatform(57, 62, 11);

    // 中途精灵岛的问号补给
    grid[9][67] = "Q"; blockMeta["67,9"] = { content: "milk", hitsLeft: 1 };
    grid[9][69] = "Q"; blockMeta["69,9"] = { content: "1up", hitsLeft: 1 };
    grid[9][71] = "Q"; blockMeta["71,9"] = { content: "star", hitsLeft: 1 };

    // 后半段高空挑战桥
    addTreePlatform(79, 86, 10);
    addTreePlatform(88, 95, 7);
    addTreePlatform(97, 106, 11);
    addTreePlatform(102, 108, 6);
    addTreePlatform(111, 118, 9);
    addTreePlatform(121, 129, 11);
    addTreePlatform(131, 139, 8);
    addTreePlatform(142, 149, 10);
    addTreePlatform(151, 157, 12);

    // 终点前台阶与旗杆
    for (let i = 0; i < 4; i++) for (let r = 12; r >= 12 - i; r--) grid[r][163 + i] = "H";
    grid[12][174] = "H";

    const bonusCoins = [
      [20, 9], [21, 9], [22, 9],
      [30, 6], [31, 6],
      [42, 4], [43, 4], [44, 4],
      [51, 7], [52, 7],
      [82, 8], [83, 8],
      [91, 5], [92, 5],
      [104, 4], [105, 4], [106, 4],
      [114, 7], [115, 7],
      [134, 6], [135, 6], [136, 6],
      [145, 8], [146, 8]
    ];

    const enemies = [
      { type: "goomba", x: 21 * T, y: 10 * T },
      { type: "koopa",  x: 30 * T, y: 7 * T },
      { type: "goomba", x: 39 * T, y: 9 * T },
      { type: "goomba", x: 51 * T, y: 8 * T },
      { type: "koopa",  x: 82 * T, y: 9 * T },
      { type: "goomba", x: 91 * T, y: 6 * T },
      { type: "goomba", x: 100 * T, y: 10 * T },
      { type: "koopa",  x: 114 * T, y: 8 * T },
      { type: "goomba", x: 125 * T, y: 10 * T },
      { type: "koopa",  x: 135 * T, y: 7 * T },
      { type: "goomba", x: 145 * T, y: 9 * T }
    ];

    const npcs = [
      {
        id: "s3-mage",
        type: "mage",
        name: "精灵法师艾琳",
        title: "天桥守望者",
        x: 73 * T,
        y: 13 * T - 22,
        facingRight: false,
        lines: [
          "呼……真开心看到你平安来到中央精灵岛，勇者奶娃！",
          "云端树冠平台可以从下方直接跳上去踩稳！前方就是恶龙盘踞的「熔岩城堡」了。",
          "我把【魔法奶瓶】、【1-UP 幸运绿奶】和【无敌加速星】封进了旁边的三个问号方块，带上它们去打倒恶龙吧！"
        ]
      }
    ];

    return {
      name: "stage3",
      theme: "highland",
      bgm: "highland",
      cols: COLS,
      rows: ROWS,
      grid,
      blockMeta,
      warpPipes: [],
      bonusCoins,
      enemies,
      npcs,
      fireballs: [],
      scenery: {
        hills: [4, 66, 162],
        bushes: [9, 170],
        clouds: [
          { x: 6, y: 2, w: 2 }, { x: 22, y: 3, w: 1 }, { x: 38, y: 1, w: 3 },
          { x: 58, y: 2, w: 2 }, { x: 78, y: 1, w: 2 }, { x: 96, y: 3, w: 3 },
          { x: 118, y: 2, w: 1 }, { x: 138, y: 1, w: 3 }, { x: 164, y: 2, w: 2 }
        ]
      },
      flagCol: 174,
      castleCol: 178,
      spawn: { x: 2.5 * T, y: 11 * T },
      exitSpawn: { x: 2.5 * T, y: 11 * T }
    };
  }

  // ================= 第四关：1-4 恶龙熔岩城堡 (最终Boss战) =================
  function buildStage4Main() {
    const COLS = 166;
    const ROWS = 15;
    const grid = makeGrid(ROWS, COLS);
    const blockMeta = {};

    const fillCastleFloor = (c1, c2, topRow = 13) => {
      for (let c = c1; c <= c2; c++) {
        for (let r = topRow; r < ROWS; r++) {
          grid[r][c] = "C";
        }
      }
    };

    const fillLava = (c1, c2) => {
      for (let c = c1; c <= c2; c++) {
        grid[13][c] = "LV";
        grid[14][c] = "LB";
      }
    };

    // 城堡石顶 (留出高空空间)
    for (let c = 0; c < COLS; c++) {
      grid[0][c] = "C";
      grid[1][c] = "C";
    }
    // 左侧封墙
    for (let r = 2; r < 13; r++) grid[r][0] = "C";

    // 城堡地面与岩浆池交替
    fillCastleFloor(0, 22, 12);
    fillLava(23, 26);
    fillCastleFloor(27, 43, 12);
    fillLava(44, 48);
    fillCastleFloor(49, 67, 12);
    fillLava(68, 72);
    fillCastleFloor(73, 91, 12);
    fillLava(92, 96);
    fillCastleFloor(97, 117, 12);
    fillLava(118, 121);
    fillCastleFloor(122, 136, 12);

    // Boss 房间：137..151 下方全是岩浆，上方是可斩断的锁链桥 (row 10)
    fillLava(137, 151);
    for (let c = 137; c <= 151; c++) {
      grid[10][c] = "BRG";
    }
    // 公主所在的右岸石台
    fillCastleFloor(152, 165, 10);
    for (let r = 2; r < 10; r++) grid[r][164] = "C";

    // 中途补给砖与高台
    grid[8][16] = "Q"; blockMeta["16,8"] = { content: "milk", hitsLeft: 1 };
    grid[8][35] = "Q"; blockMeta["35,8"] = { content: "coin", hitsLeft: 1 };
    grid[8][36] = "B";
    grid[8][37] = "Q"; blockMeta["37,8"] = { content: "coin", hitsLeft: 1 };

    // 岩浆池上方跳台
    grid[10][45] = "C"; grid[10][46] = "C";
    grid[8][55] = "Q"; blockMeta["55,8"] = { content: "milk", hitsLeft: 1 };
    grid[9][69] = "C"; grid[9][70] = "C"; grid[9][71] = "C";

    for (let c = 79; c <= 86; c++) grid[8][c] = "C";
    grid[8][94] = "C"; grid[8][95] = "C";
    grid[8][104] = "Q"; blockMeta["104,8"] = { content: "star", hitsLeft: 1 };
    grid[8][127] = "Q"; blockMeta["127,8"] = { content: "milk", hitsLeft: 1 };

    const bonusCoins = [
      [24, 9], [25, 8], [26, 9],
      [45, 8], [46, 8],
      [69, 7], [70, 7], [71, 7],
      [81, 6], [82, 6], [83, 6],
      [94, 6], [95, 6],
      [119, 8], [120, 8]
    ];

    const enemies = [
      { type: "koopa",  x: 32 * T, y: 10 * T },
      { type: "goomba", x: 58 * T, y: 11 * T },
      { type: "goomba", x: 61 * T, y: 11 * T },
      { type: "koopa",  x: 82 * T, y: 6 * T },
      { type: "goomba", x: 100 * T, y: 11 * T },
      { type: "koopa",  x: 110 * T, y: 10 * T },
      { type: "goomba", x: 129 * T, y: 11 * T }
    ];

    // 岩浆喷涌火球 (在岩浆池上方周期性上下弹跳)
    const fireballs = [
      { x: 25 * T + 2, baseY: 14 * T, phase: 0, amp: 76, speed: 0.048 },
      { x: 46 * T + 2, baseY: 14 * T, phase: 1.5, amp: 80, speed: 0.05 },
      { x: 70 * T + 2, baseY: 14 * T, phase: 0.7, amp: 82, speed: 0.052 },
      { x: 94 * T + 2, baseY: 14 * T, phase: 2.2, amp: 84, speed: 0.05 },
      { x: 119 * T + 2, baseY: 14 * T, phase: 1.1, amp: 78, speed: 0.052 }
    ];

    const npcs = [
      {
        id: "s4-knight",
        type: "knight",
        name: "先锋骑士",
        title: "破城侦察兵",
        x: 6 * T,
        y: 12 * T - 22,
        facingRight: false,
        lines: [
          "勇者奶娃！我们终于杀到「深渊红龙」的老巢了！",
          "小心脚下翻滚的岩浆与飞溅的火球！听说恶龙守着大桥尽头的【黄金战斧】，只要绕过去劈断铁链，就能让它掉进岩浆！",
          "当然，如果你够勇猛，也可以连续踩它头顶 3 次正面击败它！"
        ]
      },
      {
        id: "s4-princess",
        type: "princess",
        name: "莉莉娅公主",
        title: "牛奶王国公主",
        x: 158 * T,
        y: 10 * T - 22,
        facingRight: false,
        isPrincess: true,
        lines: [
          "太感谢你了，最勇敢的小奶娃！！你居然打败了深渊红龙救出了我！",
          "从今天起，你就是整个牛奶王国最闪耀的大英雄，全村所有的魔法牛奶都为你敞开供应！",
          "我们的《奶娃之旅》传奇，将会被世世代代传颂下去！"
        ]
      }
    ];

    return {
      name: "stage4",
      theme: "castle",
      bgm: "castle",
      cols: COLS,
      rows: ROWS,
      grid,
      blockMeta,
      warpPipes: [],
      bonusCoins,
      enemies,
      npcs,
      fireballs,
      boss: {
        x: 146 * T,
        y: 10 * T - 26,
        w: 24,
        h: 24,
        hp: 3,
        bridgeStartCol: 137,
        bridgeEndCol: 151,
        bridgeRow: 10,
        axeCol: 152,
        axeRow: 9
      },
      scenery: {
        hills: [],
        bushes: [],
        clouds: [],
        torches: [8, 18, 32, 52, 64, 78, 98, 112, 126, 140, 155]
      },
      spawn: { x: 2.5 * T, y: 10 * T },
      exitSpawn: { x: 2.5 * T, y: 10 * T }
    };
  }

  window.NaiwaLevels = {
    TILE_SOLID,
    TILE_PLATFORM,
    TILE_HAZARD,
    STAGE_INFO,
    createStageState(stageNum = 1) {
      if (stageNum === 2) {
        return { main: buildStage2Main() };
      }
      if (stageNum === 3) {
        return { main: buildStage3Main() };
      }
      if (stageNum === 4) {
        return { main: buildStage4Main() };
      }
      return {
        main: buildStage1Main(),
        overworld: buildStage1Main(),
        underground: buildStage1Underground()
      };
    },
    createLevelState() {
      return this.createStageState(1);
    }
  };
})();
