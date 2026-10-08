-- One Shot Mahjong - MySQL schema (no accounts: a player is just a username)
CREATE TABLE IF NOT EXISTS players (
  player_id          INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username           VARCHAR(40)  NOT NULL,
  username_key       VARCHAR(40)  NOT NULL,           -- lower-cased: "Lavanya" == "LAVANYA"
  created_at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_played_at     DATETIME(3)  NULL,
  games_played       INT UNSIGNED NOT NULL DEFAULT 0,
  games_won          INT UNSIGNED NOT NULL DEFAULT 0,
  games_lost         INT UNSIGNED NOT NULL DEFAULT 0,  -- losses and drawn games
  best_score         INT UNSIGNED NULL,                -- higher is better (wins only)
  best_time_ms       INT UNSIGNED NULL,                -- lower is better (wins only)
  best_moves         INT UNSIGNED NULL,                -- lower is better (wins only)
  total_score        BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_moves        INT UNSIGNED NOT NULL DEFAULT 0,
  total_play_time_ms BIGINT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_players_username_key (username_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS games (
  game_id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  player_id         INT UNSIGNED NOT NULL,
  game_number       INT UNSIGNED NULL,                 -- the player's Nth completed game
  game_mode         VARCHAR(10)  NOT NULL,
  number_of_players TINYINT UNSIGNED NOT NULL,
  difficulty        VARCHAR(10)  NOT NULL,
  tile_set          SMALLINT UNSIGNED NOT NULL,
  status            ENUM('active','completed','abandoned') NOT NULL DEFAULT 'active',
  score             INT UNSIGNED NULL,
  time_ms           INT UNSIGNED NULL,
  moves             INT UNSIGNED NULL,
  result            ENUM('WIN','LOSS','DRAW') NULL,
  winner            VARCHAR(40)  NULL,                 -- display name of the winning seat, NULL for a draw
  started_at        DATETIME(3)  NOT NULL,
  completed_at      DATETIME(3)  NULL,
  state             LONGTEXT     NULL,                 -- authoritative engine state (cleared when completed)
  details           LONGTEXT     NULL,                 -- JSON: score breakdown + personal-best comparison
  KEY idx_games_player_status (player_id, status, game_id),
  CONSTRAINT fk_games_player FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS game_actions (
  action_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  game_id     BIGINT UNSIGNED NOT NULL,
  player_id   INT UNSIGNED NULL,                       -- NULL for AI seats
  seat        TINYINT UNSIGNED NOT NULL,
  action_type VARCHAR(16) NOT NULL,                    -- draw, discard, chow, pong, kong, mahjong, flower
  tile        VARCHAR(12) NULL,
  created_at  DATETIME(3) NOT NULL,
  KEY idx_actions_game (game_id, action_id),
  CONSTRAINT fk_actions_game FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
