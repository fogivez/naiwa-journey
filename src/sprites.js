/**
 * 《奶娃之旅》像素精灵与图块缓存系统
 * 所有精灵均通过调色板矩阵预渲染到离屏 Canvas，保证 100% 锐利像素边缘。
 */
(function () {
  const NAIWA_PAL = {
    ".": null,
    "K": "#2E2010", // 轮廓深棕
    "Y": "#FCCE38", // 奶娃明黄
    "L": "#FFE878", // 高光浅黄
    "O": "#EA9E1E", // 阴影橙黄
    "B": "#F3D49E", // 圆肚皮奶白
    "S": "#DCB87C", // 肚皮阴影
    "G": "#70C65C", // 绿色虹膜
    "D": "#428A3C", // 虹膜深绿
    "E": "#121412", // 瞳孔/嘴巴
    "W": "#FFFFFF", // 闪亮高光
    "H": "#765C28", // 橄榄棕手脚
    "F": "#523E18", // 手脚阴影
    "R": "#FF4B4B", // 超级奶娃小披风/皇冠红宝石
    "C": "#FFE033"  // 超级奶娃皇冠金
  };

  // 小奶娃 (20x26) 面向右
  const NAIWA_IDLE = [
    ".....KKKKKK.........",
    "...KKLLYYYYKK.......",
    "..KLLYYGGGYGGK......",
    "..KLYYYGEGYGEK......",
    "..KLYYYGDDYGDYK.....",
    "..KLYYYYYYYEEYK.....",
    "..KYYYYYYYYKKK......",
    "..KYYYYYYYK.........",
    ".KYYYYYYYYYK........",
    ".KYYYYBBBBYYK.......",
    ".KYYOYBBBBBBYK......",
    "KYYOOYYBBBBBBYK.....",
    "KYYOOYYYHHHHBBK.....",
    "KYYOOYYYHHFFBBK.....",
    "KYYOOYBBBBBBBBK.....",
    "KYYOOYBBBBBBBSK.....",
    "KYYOOOYSSSSSSK......",
    ".KYOOOOOOOOOYK......",
    ".KOOOOOOOOOOK.......",
    "..KOOOKKKOOK........",
    "..KOOK...KOOK.......",
    "..KOOK...KOOK.......",
    "..KHHK...KHHK.......",
    "..KHHHHK.KHHHHK.....",
    "..KFFFFK.KFFFFK.....",
    "..KKKKKK.KKKKKK....."
  ];

  const NAIWA_WALK1 = [
    ".....KKKKKK.........",
    "...KKLLYYYYKK.......",
    "..KLLYYGGGYGGK......",
    "..KLYYYGEGYGEK......",
    "..KLYYYGDDYGDYK.....",
    "..KLYYYYYYYEEYK.....",
    "..KYYYYYYYYKKK......",
    "..KYYYYYYYK.........",
    ".KYYYYYYYYYK........",
    ".KYYYYBBBBYYK.......",
    ".KYYOYBBBBBBYK......",
    "KYYOOYYBBBBBBYK.....",
    "KYYOOYYYHHHHBBK.....",
    "KYYOOYYYHHFFBBK.....",
    "KYYOOYBBBBBBBBK.....",
    "KYYOOYBBBBBBBSK.....",
    "KYYOOOYSSSSSSK......",
    ".KYOOOOOOOOOYK......",
    ".KOOOOOOOOOOK.......",
    "..KOOOKKKOOK........",
    ".KOOK.....KOOK......",
    "KOOK.......KOOK.....",
    "KHHK.......KHHK.....",
    "KHHHHK.....KHHHHK...",
    "KFFFFK.....KFFFFK...",
    "KKKKKK.....KKKKKK..."
  ];

  const NAIWA_WALK2 = [
    ".....KKKKKK.........",
    "...KKLLYYYYKK.......",
    "..KLLYYGGGYGGK......",
    "..KLYYYGEGYGEK......",
    "..KLYYYGDDYGDYK.....",
    "..KLYYYYYYYEEYK.....",
    "..KYYYYYYYYKKK......",
    "..KYYYYYYYK.........",
    ".KYYYYYYYYYK........",
    ".KYYYYBBBBYYK.......",
    ".KYYOYBBBBBBYK......",
    "KYYOOYYBBBBBBYK.....",
    "KYYOOYYHHHHHBBK.....",
    "KYYOOYYHHFFHBBK.....",
    "KYYOOYBBBBBBBBK.....",
    "KYYOOYBBBBBBBSK.....",
    "KYYOOOYSSSSSSK......",
    ".KYOOOOOOOOOYK......",
    ".KOOOOOOOOOOK.......",
    "..KOOOKKKOOK........",
    "...KOOK.KOOK........",
    "....KOOOKOK.........",
    "....KHHKKHHK........",
    "....KHHHHHHHK.......",
    "....KFFFFFFFK.......",
    "....KKKKKKKKK......."
  ];

  const NAIWA_JUMP = [
    ".....KKKKKK.........",
    "...KKLLYYYYKK.......",
    "..KLLYYGGGYGGK......",
    "..KLYYYGEGYGEK......",
    "..KLYYYGDDYGDYK.....",
    "..KLYYYYYYYEEYK.....",
    "..KYYYYYYYYKKK......",
    "..KYYYYYYYK.........",
    ".KYYYYYYYYYK........",
    ".KYYYYBBBBYYKK......",
    ".KYYOYBBBBBBYHK.....",
    "KYYOOYBBBBBBYHHK....",
    "KYYOOYBBBBBBBYKK....",
    "KYYOOYBBBBBBBBK.....",
    "KYYOOYBBBBBBBBK.....",
    "KYYOOYBBBBBBBSK.....",
    "KYYOOOYSSSSSSK......",
    ".KYOOOOOOOOOYK......",
    ".KOOOOOOOOOOK.......",
    "..KOOOKKKOOK........",
    ".KHHK.....KHHK......",
    "KHHFK.....KHHFK.....",
    "KKKK.......KKKK.....",
    "....................",
    "....................",
    "...................."
  ];

  const NAIWA_SKID = [
    ".....KKKKKK.........",
    "...KKLLYYYYKK.......",
    "..KLLYYGGGYGGK......",
    "..KLYYYGEGYGEK......",
    "..KLYYYGDDYGDYK.....",
    "..KLYYYYYYYEEYK.....",
    "..KYYYYYYYYKKK......",
    "..KYYYYYYYK.........",
    ".KYYYYYYYYYK........",
    ".KYYYYBBBBYYK.......",
    ".KYYOYBBBBBBYK......",
    "KYYOOYYBBBBBBYK.....",
    "KYYOOYYYHHHHBBK.....",
    "KYYOOYYYHHFFBBK.....",
    "KYYOOYBBBBBBBBK.....",
    "KYYOOYBBBBBBBSK.....",
    "KYYOOOYSSSSSSK......",
    ".KYOOOOOOOOOYK......",
    ".KOOOOOOOOOOK.......",
    "..KOOOKKKOOK........",
    "...KOOK...KOOK......",
    "...KOOK....KOOK.....",
    "...KHHK....KHHK.....",
    "..KHHHHK..KHHHHK....",
    "..KFFFFK..KFFFFK....",
    "..KKKKKK..KKKKKK...."
  ];

  const NAIWA_HURT = [
    ".....KKKKKK.........",
    "...KKLLYYYYKK.......",
    "..KLLYYWWWYWWK......",
    "..KLYYYWEWYWEK......",
    "..KLYYYWWWYWWYK.....",
    "..KLYYYYYYYEEYK.....",
    "..KYYYYYYYYKKK......",
    "..KYYYYYYYK.........",
    ".KYYYYYYYYYK........",
    ".KYYYYBBBBYYK.......",
    ".KYYOYBBBBBBYK......",
    "KYYOOYYBBBBBBYK.....",
    "KYYOOYYYHHHHBBK.....",
    "KYYOOYYYHHFFBBK.....",
    "KYYOOYBBBBBBBBK.....",
    "KYYOOYBBBBBBBSK.....",
    "KYYOOOYSSSSSSK......",
    ".KYOOOOOOOOOYK......",
    ".KOOOOOOOOOOK.......",
    "..KOOOKKKOOK........",
    ".KHHK.....KHHK......",
    "KHHFK.....KHHFK.....",
    "KKKK.......KKKK.....",
    "....................",
    "....................",
    "...................."
  ];

  // 超级奶娃额外头顶小皇冠装饰 (叠加在头部上方，20x30)
  const CROWN_TOP = [
    "....K.K.K...........",
    "...KCRCRCK..........",
    "...KCCCCCK..........",
    "...KKKKKKK.........."
  ];

  // 蘑菇怪 (16x16)
  const GOOMBA_PAL = {
    ".": null,
    "K": "#241309",
    "B": "#C85A24",
    "D": "#8E3610",
    "T": "#F8D8B0",
    "W": "#FFFFFF",
    "F": "#3C2012"
  };
  const GOOMBA_1 = [
    ".....KKKKKK.....",
    "...KKBBBBBBKK...",
    "..KBBBBBBBBBBK..",
    ".KBBBKBBBBKBBBK.",
    ".KBBBKKBBKKBBBK.",
    "KBBBBWKBBKWBBBBK",
    "KBBBBWKBBKWBBBBK",
    "KBBBBBBBBBBBBBBK",
    "KDDDDDDDDDDDDDDK",
    ".KKKKTTTTTTKKKK.",
    "....KTTTTTTK....",
    "...KTTTTTTTTK...",
    "..KFFKTTTTKFFK..",
    ".KFFFFKKKKFFFFK.",
    ".KFFFFK..KFFFFK.",
    ".KKKKKK..KKKKKK."
  ];
  const GOOMBA_2 = [
    ".....KKKKKK.....",
    "...KKBBBBBBKK...",
    "..KBBBBBBBBBBK..",
    ".KBBBKBBBBKBBBK.",
    ".KBBBKKBBKKBBBK.",
    "KBBBBWKBBKWBBBBK",
    "KBBBBWKBBKWBBBBK",
    "KBBBBBBBBBBBBBBK",
    "KDDDDDDDDDDDDDDK",
    ".KKKKTTTTTTKKKK.",
    "....KTTTTTTK....",
    "....KTTTTTTK....",
    "...KFFKKKKFFK...",
    "..KFFFFK.KFFFFK.",
    "..KKKKKK.KKKKKK.",
    "................"
  ];
  const GOOMBA_FLAT = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "..KKKKKKKKKKKK..",
    ".KBBBBBBBBBBBBK.",
    "KBBKBBKBBKBBKBBK",
    "KDDDDDDDDDDDDDDK",
    "KKKKTTTTTTTTKKKK",
    "....KKKKKKKK...."
  ];

  // 甲壳怪 (16x22)
  const KOOPA_PAL = {
    ".": null,
    "K": "#1A2414",
    "G": "#48C048",
    "D": "#248024",
    "Y": "#FCE060",
    "O": "#E0A820",
    "W": "#FFFFFF"
  };
  const KOOPA_1 = [
    "......KKKK......",
    ".....KYYYYK.....",
    "....KYYWWYYK....",
    "....KYYWKYYK....",
    "....KYYYYYYK....",
    ".....KYYYYK.....",
    "...KKKKKKK......",
    "..KGGGGGGGK.....",
    ".KGGDDDDGGGK....",
    "KGGDDDDDDGGGYK..",
    "KGGDDDDDDGGYYK..",
    "KGGGGGGGGGGYYK..",
    "KOOOOOOOOOOKK...",
    ".KOOOOOOOOOK....",
    "..KYYK..KYYK....",
    "..KYYK..KYYK....",
    ".KOOOK..KOOOK...",
    ".KKKKK..KKKKK..."
  ];
  const KOOPA_2 = [
    "......KKKK......",
    ".....KYYYYK.....",
    "....KYYWWYYK....",
    "....KYYWKYYK....",
    "....KYYYYYYK....",
    ".....KYYYYK.....",
    "...KKKKKKK......",
    "..KGGGGGGGK.....",
    ".KGGDDDDGGGK....",
    "KGGDDDDDDGGGYK..",
    "KGGDDDDDDGGYYK..",
    "KGGGGGGGGGGYYK..",
    "KOOOOOOOOOOKK...",
    ".KOOOOOOOOOK....",
    "...KYYKKYYK.....",
    "...KYYKKYYK.....",
    "..KOOOKKOOOK....",
    "..KKKKKKK.KK...."
  ];
  const KOOPA_SHELL = [
    "................",
    "................",
    "................",
    "....KKKKKKKK....",
    "..KKGGGGGGGGKK..",
    ".KGGDDDDDDDDGGK.",
    "KGGDDDDDDDDDDGGK",
    "KGGDDGGGGGGDDGGK",
    "KGGGGGGGGGGGGGGK",
    "KOOOOOOOOOOOOOOK",
    ".KOOOOOOOOOOOOK.",
    "..KKKKKKKKKKKK.."
  ];

  // 道具精灵
  const ITEM_PAL = {
    ".": null,
    "K": "#221A14",
    "W": "#FFFFFF",
    "C": "#D6F0FF",
    "B": "#52B6FF",
    "R": "#FF4B4B",
    "Y": "#FFD838",
    "O": "#E89818",
    "G": "#44D858",
    "D": "#1E8E32"
  };

  // 魔法奶瓶 (16x16)
  const MILK_BOTTLE = [
    ".....KKKKKK.....",
    "....KRRRRRRK....",
    "....KRRRRRRK....",
    ".....KKKKKK.....",
    ".....KWWWWK.....",
    "....KWWCCWWK....",
    "...KWCCCCCCWK...",
    "..KWCCBBBBCCWK..",
    "..KWCBBBBBBCWK..",
    "..KWCCCCCCCCWK..",
    "..KWWCCCCCCWWK..",
    "..KWWWWCCWWWWK..",
    "..KWWWWWWWWWWK..",
    "...KWWWWWWWWK...",
    "...KKKKKKKKKK...",
    "................"
  ];

  // 幸运绿奶 (1-UP / 护盾奶瓶 16x16)
  const GREEN_MILK = [
    ".....KKKKKK.....",
    "....KGGGGGGK....",
    "....KDDDDDDK....",
    ".....KKKKKK.....",
    ".....KWWWWK.....",
    "....KWWGGWWK....",
    "...KWGGGGGGWK...",
    "..KWGDDDDDDGWK..",
    "..KWGDDDDDDGWK..",
    "..KWGGGGGGGGWK..",
    "..KWWGGGGGGWWK..",
    "..KWWWWGGWWWWK..",
    "..KWWWWWWWWWWK..",
    "...KWWWWWWWWK...",
    "...KKKKKKKKKK...",
    "................"
  ];

  // 无敌星星 (16x16)
  const STAR_SPR = [
    ".......KK.......",
    "......KYYK......",
    ".....KYYYYK.....",
    ".....KYYYYK.....",
    ".KKKKKYYYYKKKKK.",
    "KYYYYYYYYYYYYYYK",
    ".KYYYYKYYKYYYYK.",
    "..KYYYKYYKYYYK..",
    "...KYYYYYYYYK...",
    "...KYYYYYYYYK...",
    "..KYYYYOOYYYYK..",
    "..KYYYO..OYYYK..",
    ".KYYYO....OYYYK.",
    ".KYYK......KYYK.",
    ".KKK........KKK.",
    "................"
  ];

  // 金币 (4帧旋转动画)
  const COIN_FRAMES = [
    [
      "....KKKKKK....",
      "..KKYYYYYYKK..",
      ".KYYWWWWWWYYK.",
      "KYWWYYYYYYOOYK",
      "KYWYYOOOOYYOYK",
      "KYWYOOYYOOYOYK",
      "KYWYOOYYOOYOYK",
      "KYWYOOYYOOYOYK",
      "KYWYOOYYOOYOYK",
      "KYWYYOOOOYYOYK",
      "KYWWYYYYYYOOYK",
      ".KYYOOOOOOYYK.",
      "..KKYYYYYYKK..",
      "....KKKKKK...."
    ],
    [
      ".....KKKK.....",
      "...KKYYYYKK...",
      "..KYWWYYWWYK..",
      "..KYWYYYYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYYYYOYK..",
      "..KYWWOOOWYK..",
      "...KKYYYYKK...",
      ".....KKKK....."
    ],
    [
      "......KK......",
      ".....KYYK.....",
      "....KYWWYK....",
      "....KYWOYK....",
      "....KYWOYK....",
      "....KYWOYK....",
      "....KYWOYK....",
      "....KYWOYK....",
      "....KYWOYK....",
      "....KYWOYK....",
      "....KYWOYK....",
      "....KYOOYK....",
      ".....KYYK.....",
      "......KK......"
    ],
    [
      ".....KKKK.....",
      "...KKYYYYKK...",
      "..KYWWYYWWYK..",
      "..KYWYYYYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYOOYOYK..",
      "..KYWYYYYOYK..",
      "..KYWWOOOWYK..",
      "...KKYYYYKK...",
      ".....KKKK....."
    ]
  ];

  function createCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function renderMatrix(matrix, palette) {
    const h = matrix.length;
    const w = matrix[0].length;
    const c = createCanvas(w, h);
    const ctx = c.getContext("2d");
    for (let y = 0; y < h; y++) {
      const row = matrix[y];
      for (let x = 0; x < w; x++) {
        const col = palette[row[x]];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return c;
  }

  function flipCanvas(src) {
    const c = createCanvas(src.width, src.height);
    const ctx = c.getContext("2d");
    ctx.translate(src.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return c;
  }

  function makeBigNaiwa(smallMatrix) {
    const combined = CROWN_TOP.concat(smallMatrix);
    const base = renderMatrix(combined, NAIWA_PAL);
    // 略微放大并保持像素锐利 (22x30)
    const big = createCanvas(22, 30);
    const ctx = big.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, 22, 30);
    return big;
  }

  function makeStarTint(srcCanvas, paletteIndex) {
    const c = createCanvas(srcCanvas.width, srcCanvas.height);
    const ctx = c.getContext("2d");
    ctx.drawImage(srcCanvas, 0, 0);
    const tints = ["rgba(255, 80, 180, 0.38)", "rgba(80, 255, 220, 0.38)", "rgba(255, 255, 90, 0.42)"];
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = tints[paletteIndex % tints.length];
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function buildTileSprites() {
    const tiles = {};

    // 地面方块 (16x16)
    const mkGround = (topColor, mainColor, darkColor, highlight) => {
      const c = createCanvas(16, 16);
      const x = c.getContext("2d");
      x.fillStyle = mainColor;
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = topColor;
      x.fillRect(0, 0, 16, 3);
      x.fillStyle = highlight;
      x.fillRect(1, 4, 6, 4);
      x.fillRect(9, 4, 5, 4);
      x.fillRect(3, 10, 6, 4);
      x.fillStyle = darkColor;
      x.fillRect(0, 8, 16, 1);
      x.fillRect(7, 3, 1, 5);
      x.fillRect(14, 3, 1, 6);
      x.fillRect(10, 9, 1, 7);
      x.fillRect(0, 15, 16, 1);
      return c;
    };
    tiles.ground = mkGround("#5AC848", "#C85A28", "#74280C", "#E48850");
    tiles.groundUnder = mkGround("#3890B8", "#1C4870", "#0E243C", "#2A6898");

    // 砖块 (16x16)
    const mkBrick = (bg, mortar, light) => {
      const c = createCanvas(16, 16);
      const x = c.getContext("2d");
      x.fillStyle = bg;
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = light;
      x.fillRect(0, 0, 16, 1);
      x.fillRect(0, 8, 16, 1);
      x.fillStyle = mortar;
      x.fillRect(0, 7, 16, 1);
      x.fillRect(0, 15, 16, 1);
      x.fillRect(7, 0, 1, 7);
      x.fillRect(15, 0, 1, 7);
      x.fillRect(3, 8, 1, 7);
      x.fillRect(11, 8, 1, 7);
      return c;
    };
    tiles.brick = mkBrick("#C84C1C", "#421406", "#F09860");
    tiles.brickUnder = mkBrick("#246898", "#0A2038", "#50A4D8");

    // 问号方块 (3帧闪烁)
    const qColors = [
      ["#F8B828", "#FFE878", "#985008"],
      ["#F89818", "#FFD058", "#884008"],
      ["#E87810", "#FFB840", "#703008"]
    ];
    tiles.question = qColors.map(([bg, hi, sh]) => {
      const c = createCanvas(16, 16);
      const x = c.getContext("2d");
      x.fillStyle = bg;
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = hi;
      x.fillRect(0, 0, 15, 1);
      x.fillRect(0, 0, 1, 15);
      x.fillStyle = sh;
      x.fillRect(0, 15, 16, 1);
      x.fillRect(15, 0, 1, 16);
      // 四个铆钉
      x.fillStyle = "#502404";
      x.fillRect(2, 2, 1, 1);
      x.fillRect(13, 2, 1, 1);
      x.fillRect(2, 13, 1, 1);
      x.fillRect(13, 13, 1, 1);
      // 问号投影
      x.fillStyle = "#502404";
      x.fillRect(6, 4, 5, 2);
      x.fillRect(9, 6, 2, 2);
      x.fillRect(7, 8, 3, 2);
      x.fillRect(7, 11, 2, 2);
      // 问号亮白
      x.fillStyle = "#FFF8E0";
      x.fillRect(5, 3, 5, 2);
      x.fillRect(8, 5, 2, 2);
      x.fillRect(6, 7, 3, 2);
      x.fillRect(6, 10, 2, 2);
      return c;
    });

    // 已顶过的空方块
    {
      const c = createCanvas(16, 16);
      const x = c.getContext("2d");
      x.fillStyle = "#9C6838";
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = "#C89868";
      x.fillRect(1, 1, 14, 1);
      x.fillRect(1, 1, 1, 14);
      x.fillStyle = "#482C14";
      x.fillRect(0, 15, 16, 1);
      x.fillRect(15, 0, 1, 16);
      x.fillRect(2, 2, 1, 1);
      x.fillRect(13, 2, 1, 1);
      x.fillRect(2, 13, 1, 1);
      x.fillRect(13, 13, 1, 1);
      tiles.used = c;
    }

    // 台阶石块 (16x16)
    {
      const c = createCanvas(16, 16);
      const x = c.getContext("2d");
      x.fillStyle = "#C87038";
      x.fillRect(0, 0, 16, 16);
      x.fillStyle = "#F0B078";
      x.fillRect(0, 0, 15, 2);
      x.fillRect(0, 0, 2, 15);
      x.fillStyle = "#682808";
      x.fillRect(0, 14, 16, 2);
      x.fillRect(14, 0, 2, 16);
      x.fillStyle = "#A05020";
      x.fillRect(3, 3, 10, 10);
      tiles.hard = c;
    }

    // 绿色水管图块
    const mkPipeStrip = (isTop, isLeft) => {
      const c = createCanvas(16, 16);
      const x = c.getContext("2d");
      if (isTop) {
        x.fillStyle = "#38B828";
        x.fillRect(0, 0, 16, 16);
        x.fillStyle = "#88F060";
        x.fillRect(isLeft ? 2 : 0, 2, isLeft ? 5 : 3, 12);
        x.fillStyle = "#187010";
        x.fillRect(isLeft ? 13 : 10, 2, isLeft ? 3 : 4, 12);
        x.fillStyle = "#0C2808";
        x.fillRect(0, 0, 16, 2);
        x.fillRect(0, 14, 16, 2);
        if (isLeft) x.fillRect(0, 0, 2, 16);
        else x.fillRect(14, 0, 2, 16);
      } else {
        x.fillStyle = "#38B828";
        x.fillRect(isLeft ? 2 : 0, 0, isLeft ? 14 : 14, 16);
        x.fillStyle = "#88F060";
        x.fillRect(isLeft ? 4 : 0, 0, isLeft ? 4 : 2, 16);
        x.fillStyle = "#187010";
        x.fillRect(isLeft ? 13 : 8, 0, isLeft ? 3 : 4, 16);
        x.fillStyle = "#0C2808";
        if (isLeft) x.fillRect(2, 0, 2, 16);
        else x.fillRect(12, 0, 2, 16);
      }
      return c;
    };
    tiles.pipeTopL = mkPipeStrip(true, true);
    tiles.pipeTopR = mkPipeStrip(true, false);
    tiles.pipeBodyL = mkPipeStrip(false, true);
    tiles.pipeBodyR = mkPipeStrip(false, false);

    return tiles;
  }

  class SpriteBank {
    constructor() {
      this.naiwaSmall = {
        idle: renderMatrix(NAIWA_IDLE, NAIWA_PAL),
        walk1: renderMatrix(NAIWA_WALK1, NAIWA_PAL),
        walk2: renderMatrix(NAIWA_WALK2, NAIWA_PAL),
        jump: renderMatrix(NAIWA_JUMP, NAIWA_PAL),
        skid: renderMatrix(NAIWA_SKID, NAIWA_PAL),
        hurt: renderMatrix(NAIWA_HURT, NAIWA_PAL)
      };
      this.naiwaSmallFlip = {};
      Object.keys(this.naiwaSmall).forEach((k) => {
        this.naiwaSmallFlip[k] = flipCanvas(this.naiwaSmall[k]);
      });

      this.naiwaBig = {
        idle: makeBigNaiwa(NAIWA_IDLE),
        walk1: makeBigNaiwa(NAIWA_WALK1),
        walk2: makeBigNaiwa(NAIWA_WALK2),
        jump: makeBigNaiwa(NAIWA_JUMP),
        skid: makeBigNaiwa(NAIWA_SKID),
        hurt: makeBigNaiwa(NAIWA_HURT)
      };
      this.naiwaBigFlip = {};
      Object.keys(this.naiwaBig).forEach((k) => {
        this.naiwaBigFlip[k] = flipCanvas(this.naiwaBig[k]);
      });

      this.goomba = [
        renderMatrix(GOOMBA_1, GOOMBA_PAL),
        renderMatrix(GOOMBA_2, GOOMBA_PAL),
        renderMatrix(GOOMBA_FLAT, GOOMBA_PAL)
      ];

      this.koopa = {
        r1: renderMatrix(KOOPA_1, KOOPA_PAL),
        r2: renderMatrix(KOOPA_2, KOOPA_PAL),
        l1: flipCanvas(renderMatrix(KOOPA_1, KOOPA_PAL)),
        l2: flipCanvas(renderMatrix(KOOPA_2, KOOPA_PAL)),
        shell: renderMatrix(KOOPA_SHELL, KOOPA_PAL)
      };

      this.items = {
        milk: renderMatrix(MILK_BOTTLE, ITEM_PAL),
        greenMilk: renderMatrix(GREEN_MILK, ITEM_PAL),
        star: renderMatrix(STAR_SPR, ITEM_PAL),
        coins: COIN_FRAMES.map((m) => renderMatrix(m, ITEM_PAL))
      };

      this.tiles = buildTileSprites();
    }

    getNaiwaFrame(pose, facingRight, isBig, starFlashIdx = -1) {
      const bank = isBig
        ? (facingRight ? this.naiwaBig : this.naiwaBigFlip)
        : (facingRight ? this.naiwaSmall : this.naiwaSmallFlip);
      const base = bank[pose] || bank.idle;
      if (starFlashIdx >= 0) {
        return makeStarTint(base, starFlashIdx);
      }
      return base;
    }
  }

  window.SpriteBank = new SpriteBank();
})();
