# LESSONS.md — Mission Dashboard

อัปเดตล่าสุด: 2026-02-28

## Incident: Team Refresh UI กว่าจะขึ้นจริงต้องแก้หลายรอบ

### Root Causes
1. **Deploy/runtime ไม่ตรงกับโค้ดล่าสุด**
   - โค้ดใน `main` ถูกแล้ว แต่ process ที่รันพอร์ต 4000 ยัง serve bundle เก่า
2. **Process ค้างหลายตัว**
   - มี `next-server`/`npm start` ซ้อนกัน ทำให้พฤติกรรมไม่คงที่
3. **Cache confusion (build + browser)**
   - ผู้ใช้เห็น UI เก่าแม้ commit ใหม่มาแล้ว เพราะ cache และ instance เก่า
4. **การสื่อสารคำสั่งไม่เหมาะกับผู้ใช้จริง**
   - ส่งคำสั่งแบบหลายบรรทัดมีคอมเมนต์ ทำให้ copy-paste ใช้งานยาก
5. **Debug marker ชั่วคราวค้างใน UI**
   - ใส่ version tag เพื่อ debug แล้วต้องรีบถอดเมื่อยืนยันเสร็จ

## What Worked
- ตรวจ endpoint `/api/agents` โดยตรงช่วยยืนยันว่า backend ถูกแล้ว
- ใส่ visual feedback บนปุ่ม (Refreshing..., Updated, counter) ช่วยพิสูจน์การทำงาน
- แยกปัญหาเป็น 3 ชั้น: code / runtime process / browser cache ทำให้หาต้นตอเจอเร็ว

## Non-Negotiable Rules (บังคับใช้ทุกงาน Mission Dashboard)
1. **Preflight ก่อนแก้**
   - ยืนยัน path/proj ถูกต้อง: `~/mission-control`
   - ยืนยัน branch/commit ที่จะทำงาน
2. **หลังแก้ทุกครั้งต้อง verify 3 ชั้น**
   - Source: ไฟล์แก้ถูก
   - Build: `npm run build` ผ่าน
   - Runtime: หน้าเว็บแสดงผลตรงกับสิ่งที่แก้
3. **คำสั่งให้ผู้ใช้ต้องเป็น one-liner copy-paste ได้ทันที**
   - ห้ามส่งชุดคอมเมนต์หลายบรรทัดที่ต้องแก้เอง
4. **ถ้าใช้ debug label ใน UI ให้ลบออกทันทีหลังยืนยันผล**
5. **รายงานผลในกลุ่มทันทีหลังงานเสร็จ**

## Standard Recovery One-liner (เมื่อสงสัยว่า serve โค้ดเก่า)
```bash
cd ~/mission-control && pkill -9 -f "next-server|next start -p 4000|npm start" || true; git checkout main && git pull origin main && rm -rf .next node_modules/.cache && npm run build && npm start
```

## Mission Dashboard Pre-Task Checklist
ก่อนเริ่มงาน Mission Dashboard ทุกครั้ง ต้องทำ:
1. อ่านไฟล์นี้ก่อน (`LESSONS.md`)
2. สรุปในใจว่า risk รอบนี้คืออะไร (code/runtime/cache/communication)
3. เลือกวิธี verify ที่วัดผลได้จริงบน UI

## Playbook: แก้โค้ดแล้ว Interface ยังไม่เปลี่ยน (UI Stale)

### อาการ
- commit ใหม่แล้ว แต่หน้าเว็บยังแสดง UI เดิม
- ปุ่ม/ข้อความที่แก้ไม่เปลี่ยน
- บางครั้งเปลี่ยนชั่วคราวแล้วเด้งกลับ

### สาเหตุที่พบบ่อย
1. `next-server` ตัวเก่ายังรันอยู่ (serve build เก่า)
2. มีหลาย process ชนกันบนพอร์ต 4000
3. `.next` cache ยังอ้าง bundle เดิม
4. browser cache ค้าง
5. อัปเดตโค้ดแล้วแต่ runtime ยังไม่ restart ด้วย build ใหม่

### วิธีแก้มาตรฐาน (one-liner)
```bash
cd ~/mission-control && pkill -9 -f "next-server|next start -p 4000|npm start" || true; git checkout main && git pull origin main && rm -rf .next node_modules/.cache && npm run build && npm start
```

### วิธี verify ว่าหายจริง
1. เช็ค commit ปัจจุบัน
```bash
cd ~/mission-control && git log --oneline -1
```
2. เช็ค process ที่รันอยู่
```bash
pgrep -af "next-server|next start -p 4000|npm start" || true
```
3. เปิดหน้าใน Incognito หรือ hard reload (Cmd+Shift+R)
4. ถ้ายังไม่เปลี่ยน ให้ใส่ debug marker ชั่วคราวใน UI (เช่นข้อความเวอร์ชัน) เพื่อพิสูจน์ build ที่ browser โหลด แล้วลบออกทันทีหลังยืนยัน
