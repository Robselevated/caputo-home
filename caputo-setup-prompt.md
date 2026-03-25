# Step 1 — Enable Agent Teams

Please do the following steps in order before we start building anything:

1. Create a `.claude/settings.local.json` file in this project with the 
   following content: `{"experimentalAgentTeams": true}`

2. Fetch the Claude Code agent teams documentation from this URL: 
   https://docs.anthropic.com/en/docs/claude-code/agent-teams
   Read through it fully and create a master reference guide saved to 
   `/docs/agent-teams-reference.md`. This will be used throughout the 
   build so you can refer back to it any time you need to know how to 
   structure, prompt, or manage agent teams effectively.

3. Confirm that the following three project files exist in the root 
   of this project before we proceed:
   - master-prompt.md
   - schema.sql
   - taxonomy.md
   
   If any of these are missing, stop and tell me so I can add them 
   before we continue.

4. Confirm back to me that:
   - Agent teams are enabled
   - The reference doc has been created at /docs/agent-teams-reference.md
   - All three project files are present
   
   Once you confirm all four things are good, I will give you the 
   next prompt to begin the build.
