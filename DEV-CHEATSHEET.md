# 🚀 ServiceLink Dev Cheatsheet

### 📂 Navigation
- Go to repo root:
  ```bash
  cd ~/Projects/servicelink
🛠 Common Commands
Command
Purpose
pnpm install
Install all dependencies
pnpm dev
Start dev servers (API + web)
pnpm build
Build the project
pnpm prisma:gen
Generate Prisma client
pnpm db:migrate
Apply/create migrations (default name = init, change as needed)
pnpm db:seed
Seed database with test data (apps/api/src/prisma/seed.ts)
pnpm db:reset
Drop, re-migrate, and re-seed database
pnpm db:studio
Open Prisma Studio GUI in browser


🔄 Migration workflow
	1.	Edit schema: nano apps/api/src/prisma/schema.prisma
	2.	Create/apply migration: pnpm db:migrate (change init in script or run full command manually with a descriptive name)
        3.	Regenerate client: pnpm prisma:gen
        4.	Seed data (if needed): pnpm db:seed
	
	🧹 Resetting database
	•	Drops database
	•	Recreates schema
	•	Applies all migrations
	•	Seeds with seed.ts 
	
	👀 GUI
	pnpm db:studio
	•	Opens Prisma Studio at http://localhost:5555

---

### 4. Save & exit
- `CTRL+O` → `Enter`  
- `CTRL+X`

---

Now you’ll always have a **local cheatsheet** you can open quickly:

```bash
nano DEV-CHEATSHEET.md

or in VS Code:

code DEV-CHEATSHEET.md

---

# 🌿 Git Workflow Cheatsheet

### 🔑 First-time setup
1. Check Git is installed:
   ```bash
   git --version

2. Set username & email (once per machine):
git config --global user.name "Your Name"
git config --global user.email "you@example.com"

📂 Daily Workflow

Command  				Purpose
git status				See which files changed
git add .				Stage all changes
git commit -m "your message" 		Commit staged changes
git push origin main			Push commits to GitHub (main branch)
git pull origin main			Sync latest changes from GitHub


🌱 Branching Workflow
•  Create a new branch:	   git checkout -b feature/my-feature
•  Switch back to main:   git checkout main
•	Push branch to GitHub:   git push origin feature/my-feature
•	Merge branch into main (after PR/approval):   git checkout main
						      git pull origin main
						      git merge feature/my-feature
						      git push origin main

🚨 Safety Tips
	•	Always git pull origin main before starting work.
	•	Use descriptive commit messages (e.g., add provider onboarding, not just stuff).
	•	For Codex changes, commit them under a branch like codex/seed-update → keeps history clear.

---

### ✅ Next Steps
1. Open the cheatsheet:
   ```bash
   nano DEV-CHEATSHEET.md
