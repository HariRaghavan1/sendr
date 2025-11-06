# Pre-commit Hooks Setup

This project is configured to use Husky for Git hooks to ensure code quality before commits.

## Installation

To set up pre-commit hooks, follow these steps:

### 1. Install Husky

```bash
npm install --save-dev husky
```

### 2. Initialize Husky

```bash
npx husky init
```

### 3. The pre-commit hook is already configured

The `.husky/pre-commit` file in this repository will automatically:
- Run ESLint to check code quality
- Run TypeScript type checking

### 4. Make the hook executable (Unix/Mac only)

```bash
chmod +x .husky/pre-commit
```

## What Gets Checked

Before each commit, the following checks run automatically:

1. **ESLint** - Checks code style and catches common errors
2. **TypeScript** - Ensures no type errors exist

If any check fails, the commit will be blocked until you fix the issues.

## Skipping Hooks (Use Sparingly!)

If you need to skip hooks in an emergency:

```bash
git commit --no-verify -m "your message"
```

**Warning:** Only use `--no-verify` when absolutely necessary!

## Customization

To modify what runs before commit, edit `.husky/pre-commit`:

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Add your custom commands here
npm run lint
npx tsc --noEmit
# npm test  # Uncomment when tests are added
```

## Troubleshooting

### Hook not running
- Ensure `.husky/pre-commit` is executable: `chmod +x .husky/pre-commit`
- Check that Husky is installed: `npm list husky`
- Reinitialize: `npx husky install`

### Hook failing unexpectedly
- Run the commands manually to see the actual errors:
  ```bash
  npm run lint
  npx tsc --noEmit
  ```

## Benefits

✅ Catches errors before they enter the codebase
✅ Maintains consistent code quality
✅ Prevents broken commits
✅ Saves time in code review
