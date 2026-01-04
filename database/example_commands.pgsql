-- Commands can be used in chat to trigger specific actions.
-- Mostly used for moderation and utility functions.
-- @version 0.0.1
CREATE TABLE IF NOT EXISTS commands (
  command TEXT PRIMARY KEY,
  level INT NOT NULL CHECK (level BETWEEN 0 AND 99)
);

INSERT INTO commands (command, level) VALUES
  ('/help', 0)

-- @version 0.0.2
CREATE TABLE IF NOT EXISTS user_command_level (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  command_level int NOT NULL CHECK (command_level BETWEEN 0 AND 99) DEFAULT 0
);

-- @version 0.0.2
CREATE POLICY "Users can read their own command level" ON user_command_level FOR SELECT USING (user_id = auth.uid());

-- @version 0.0.2
CREATE POLICY "Users can read which commands they can execute" ON commands FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_command_level
    WHERE user_id = auth.uid() AND command_level >= commands.level
  )
);
