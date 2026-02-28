# Mission Dashboard Workflow (Known-Good + Verification)

## 0) Start from known-good baseline
```bash
cd ~/mission-control && git fetch --tags && git checkout main && git pull --ff-only origin main
```

## 1) Before coding — baseline check
```bash
cd ~/mission-control && git describe --tags --exact-match 2>/dev/null || echo "(not on a tag)"; git log --oneline -1
```

## 2) Deploy + health check
```bash
cd ~/mission-control && ./scripts/deploy-mission.sh
```

## 3) Quick functional check
```bash
cd ~/mission-control && ./scripts/check-mission.sh
```

## 4) During feature work
- แก้ทีละ concern (ไม่ผสม config + UI + cron ใน commit เดียว)
- build ให้ผ่านทุกครั้ง
- เช็คหน้าที่แก้จริง + endpoint ที่เกี่ยวข้อง

## 5) Mark new known-good after verified
```bash
cd ~/mission-control && git tag -a kg-YYYY-MM-DD-<name> -m "Known-good baseline" && git push origin kg-YYYY-MM-DD-<name>
```

## 6) Fast rollback to known-good
```bash
cd ~/mission-control && git fetch --tags && git checkout kg-2026-02-28-mission-dashboard && ./scripts/deploy-mission.sh
```
