import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

async function migrateFromSupabaseToSQLite(supabaseData: any, dbPath: string) {
  try {
    // Open the SQLite database
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Enable foreign key constraints
    await db.run('PRAGMA foreign_keys = ON');

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Migrate profiles
      if (supabaseData.profiles && supabaseData.profiles.length > 0) {
        console.log(`Migrating ${supabaseData.profiles.length} profiles...`);
        for (const profile of supabaseData.profiles) {
          await db.run(
            `INSERT OR REPLACE INTO profiles 
             (id, user_id, username, wallet_address, balance, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              profile.id,
              profile.user_id,
              profile.username,
              profile.wallet_address,
              profile.balance || 0,
              profile.created_at || new Date().toISOString(),
              profile.updated_at || new Date().toISOString(),
            ]
          );
        }
      }

      // Migrate transactions
      if (supabaseData.transactions && supabaseData.transactions.length > 0) {
        console.log(`Migrating ${supabaseData.transactions.length} transactions...`);
        for (const tx of supabaseData.transactions) {
          await db.run(
            `INSERT OR REPLACE INTO transactions 
             (id, user_id, type, amount, status, blockchain_tx_hash, wallet_address, description, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              tx.id,
              tx.user_id,
              tx.type,
              tx.amount,
              tx.status || 'completed',
              tx.blockchain_tx_hash,
              tx.wallet_address,
              tx.description,
              typeof tx.metadata === 'string' ? tx.metadata : JSON.stringify(tx.metadata || {}),
              tx.created_at || new Date().toISOString(),
              tx.updated_at || new Date().toISOString(),
            ]
          );
        }
      }

      // Migrate chess games
      if (supabaseData.chess_games && supabaseData.chess_games.length > 0) {
        console.log(`Migrating ${supabaseData.chess_games.length} chess games...`);
        for (const game of supabaseData.chess_games) {
          await db.run(
            `INSERT OR REPLACE INTO chess_games 
             (id, player1_id, player2_id, wager, status, winner_id, game_state, moves, 
              player1_time, player2_time, current_turn, last_move_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              game.id,
              game.player1_id,
              game.player2_id,
              game.wager || 0,
              game.status || 'waiting',
              game.winner_id,
              game.game_state || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              typeof game.moves === 'string' ? game.moves : JSON.stringify(game.moves || []),
              game.player1_time || 600000,
              game.player2_time || 600000,
              game.current_turn || 'player1',
              game.last_move_at || new Date().toISOString(),
              game.created_at || new Date().toISOString(),
              game.updated_at || new Date().toISOString(),
            ]
          );
        }
      }

      // Migrate ludo games
      if (supabaseData.ludo_games && supabaseData.ludo_games.length > 0) {
        console.log(`Migrating ${supabaseData.ludo_games.length} ludo games...`);
        for (const game of supabaseData.ludo_games) {
          await db.run(
            `INSERT OR REPLACE INTO ludo_games 
             (id, player1_id, player2_id, player3_id, player4_id, num_players, status, 
              current_turn, wager, winner_id, game_state, moves, last_move_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              game.id,
              game.player1_id,
              game.player2_id,
              game.player3_id,
              game.player4_id,
              game.num_players || 2,
              game.status || 'waiting',
              game.current_turn || 1,
              game.wager || 0,
              game.winner_id,
              typeof game.game_state === 'string' ? game.game_state : JSON.stringify(game.game_state || {
                player1: { tokens: [0, 0, 0, 0], color: 'red' },
                player2: { tokens: [0, 0, 0, 0], color: 'yellow' },
                player3: { tokens: [0, 0, 0, 0], color: 'green' },
                player4: { tokens: [0, 0, 0, 0], color: 'blue' },
                lastRoll: null
              }),
              typeof game.moves === 'string' ? game.moves : JSON.stringify(game.moves || []),
              game.last_move_at || new Date().toISOString(),
              game.created_at || new Date().toISOString(),
              game.updated_at || new Date().toISOString(),
            ]
          );
        }
      }

      // Commit the transaction
      await db.run('COMMIT');
      console.log('Migration completed successfully!');
    } catch (error) {
      // Rollback in case of error
      await db.run('ROLLBACK');
      console.error('Error during migration:', error);
      throw error;
    } finally {
      // Close the database connection
      await db.close();
    }
  } catch (error) {
    console.error('Failed to migrate data:', error);
    throw error;
  }
}

// Example usage:
// First, export your Supabase data to a JSON file
// Then read it and pass to this function
/*
async function runMigration() {
  try {
    // Read the exported Supabase data
    const supabaseData = JSON.parse(fs.readFileSync('path/to/supabase-export.json', 'utf-8'));
    
    // Path to the SQLite database
    const dbPath = path.join(__dirname, 'wallet.db');
    
    // Run the migration
    await migrateFromSupabaseToSQLite(supabaseData, dbPath);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();
*/

export { migrateFromSupabaseToSQLite };
