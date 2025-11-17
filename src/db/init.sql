-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  wallet_address TEXT,
  balance REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now'))
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'wager', 'win', 'refund')),
  amount REAL NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  blockchain_tx_hash TEXT,
  wallet_address TEXT,
  description TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);

-- Create chess_games table
CREATE TABLE IF NOT EXISTS chess_games (
  id TEXT PRIMARY KEY,
  player1_id TEXT NOT NULL,
  player2_id TEXT,
  wager REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'in_progress', 'completed', 'cancelled')),
  winner_id TEXT,
  game_state TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves TEXT DEFAULT '[]',
  player1_time INTEGER NOT NULL DEFAULT 600000,
  player2_time INTEGER NOT NULL DEFAULT 600000,
  current_turn TEXT NOT NULL DEFAULT 'player1' CHECK (current_turn IN ('player1', 'player2')),
  last_move_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  FOREIGN KEY (player1_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  FOREIGN KEY (player2_id) REFERENCES profiles(user_id) ON DELETE SET NULL,
  FOREIGN KEY (winner_id) REFERENCES profiles(user_id) ON DELETE SET NULL
);

-- Create ludo_games table
CREATE TABLE IF NOT EXISTS ludo_games (
  id TEXT PRIMARY KEY,
  player1_id TEXT NOT NULL,
  player2_id TEXT,
  player3_id TEXT,
  player4_id TEXT,
  num_players INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'waiting',
  current_turn INTEGER NOT NULL DEFAULT 1,
  wager REAL NOT NULL DEFAULT 0,
  winner_id TEXT,
  game_state TEXT NOT NULL DEFAULT '{"player1": {"tokens": [0,0,0,0], "color": "red"}, "player2": {"tokens": [0,0,0,0], "color": "yellow"}, "player3": {"tokens": [0,0,0,0], "color": "green"}, "player4": {"tokens": [0,0,0,0], "color": "blue"}, "lastRoll": null}',
  moves TEXT DEFAULT '[]',
  last_move_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
  FOREIGN KEY (player1_id) REFERENCES profiles(user_id) ON DELETE CASCADE,
  FOREIGN KEY (player2_id) REFERENCES profiles(user_id) ON DELETE SET NULL,
  FOREIGN KEY (player3_id) REFERENCES profiles(user_id) ON DELETE SET NULL,
  FOREIGN KEY (player4_id) REFERENCES profiles(user_id) ON DELETE SET NULL,
  FOREIGN KEY (winner_id) REFERENCES profiles(user_id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_blockchain_tx ON transactions(blockchain_tx_hash) WHERE blockchain_tx_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_chess_games_player1 ON chess_games(player1_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_player2 ON chess_games(player2_id);
CREATE INDEX IF NOT EXISTS idx_chess_games_status ON chess_games(status);
CREATE INDEX IF NOT EXISTS idx_ludo_games_status ON ludo_games(status);

-- Create triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_profiles_updated_at
AFTER UPDATE ON profiles
BEGIN
  UPDATE profiles SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_chess_games_updated_at
AFTER UPDATE ON chess_games
BEGIN
  UPDATE chess_games SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ludo_games_updated_at
AFTER UPDATE ON ludo_games
BEGIN
  UPDATE ludo_games SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_transactions_updated_at
AFTER UPDATE ON transactions
BEGIN
  UPDATE transactions SET updated_at = strftime('%Y-%m-%d %H:%M:%f', 'now') WHERE id = NEW.id;
END;
