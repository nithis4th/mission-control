# Mission Board 2.0 Backup/Restore Notes

- Baseline tag: kg-20260228-2227-pre-mission2
- Baseline commit: 07111ce

## Quick rollback

```bash
git checkout main
git reset --hard kg-20260228-2227-pre-mission2
```

## Safety rules
- Commit every phase
- Keep feature work in `feature/mission-board-v2`
- Run `npm run build` before phase handoff
