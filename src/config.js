/**
 * 《奶娃之旅》全局配置
 * 作者: forgivez
 */
window.NAIWA_CONFIG = {
  gameTitle: "奶娃之旅",
  levelName: "1-1 奶娃大草原",
  authorName: "forgivez",
  authorAvatarPath: "assets/author.jpg",
  naiwaPortraitPath: "assets/naiwa_pixel.png",

  // 画布内部像素分辨率 (16px 一个方块，共 25x15 个方块视野)
  VIEW_WIDTH: 400,
  VIEW_HEIGHT: 240,
  TILE_SIZE: 16,

  // 默认玩家名称
  DEFAULT_PLAYER_NAME: "小奶娃",

  /**
   * 可选：全球实时云端排行榜配置 (Supabase REST API)
   * 若保持为空字符串，游戏默认启用【本地持久化 + 跨标签页 BroadcastChannel 实时同步 + 官方NPC基准榜】。
   * 上传 GitHub Pages 后，如需所有访客共享全球实时排名，只需填入免费 Supabase 项目的 URL 与 Anon Key（见 README.md）。
   */
  CLOUD_LEADERBOARD: {
    supabaseUrl: "https://cebmveeilcxprzgntezi.supabase.co",      // 例如: "https://xxxxx.supabase.co"
    supabaseAnonKey: "sb_publishable_rG7MqbIrE92J4dUu8M7Wkg_YN8nXX7y",  // Supabase public anon / publishable key
    tableName: "naiwa_leaderboard",
    pollIntervalMs: 10000
  }
};
