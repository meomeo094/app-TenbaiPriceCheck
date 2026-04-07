# Tổng hợp kỹ năng (ECC / everything-claude-code)

Nguồn: [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code). Trong repo **không có** đúng tên `testing-automation.md`, `database-management.md`, `backend-development.md`; nội dung dưới đây được **tổng hợp** từ các skill tương đương:

| Bạn yêu cầu | File nguồn trong repo |
|-------------|------------------------|
| Testing automation | `.agents/skills/e2e-testing/SKILL.md` + `.agents/skills/tdd-workflow/SKILL.md` |
| Database management | `skills/database-migrations/SKILL.md` |
| Backend development | `skills/backend-patterns/SKILL.md` |

---

## 1. Tự động hóa & kiểm thử (E2E + TDD)

### Từ e2e-testing (Playwright)

- **Cấu trúc thư mục:** `tests/e2e/` theo domain (`auth/`, `features/`, `api/`), kèm `fixtures/`, `playwright.config.ts`.
- **Page Object Model (POM):** class bọc `Page`, `Locator`, method `goto()`, hành vi UI; tái sử dụng giữa các spec.
- **Spec:** `beforeEach` khởi tạo POM, test mô tả hành vi người dùng; `expect` + auto-wait locator; tránh `waitForTimeout` cố định — ưu tiên `waitForResponse`, `waitForLoadState('networkidle')`.
- **playwright.config:** `testDir`, `fullyParallel`, `retries` trên CI, `reporter` (html, junit, json), `trace`/`screenshot`/`video` on failure, `webServer` chạy app dev, `projects` (chromium, firefox, webkit, mobile).
- **Flaky:** `test.fixme`, `test.skip` trên CI, `--repeat-each`, `--retries`; sửa race bằng locator thay vì click ngẫu nhiên; chờ network/visible thay vì sleep.
- **Artifact:** screenshot full page / element, trace, video; CI upload report.
- **CI:** GitHub Actions — install browsers, `playwright test`, upload artifact.
- **Đặc thù:** Web3 mock `window.ethereum`; flow tài chính — `test.skip` trên production, chờ API/blockchain với timeout hợp lý.

### Từ tdd-workflow

- **Khi dùng:** feature mới, sửa bug, refactor, API mới, component mới.
- **Nguyên tắc:** viết test **trước** code; mục tiêu **≥80%** coverage (unit + integration + E2E); cover edge case và lỗi.
- **Loại test:** unit (hàm/pure/component logic), integration (API, DB, service), E2E (Playwright — luồng người dùng).
- **Bước TDD:** user journey → test cases → chạy (fail) → implement tối thiểu → chạy (pass) → refactor → `test:coverage`.
- **Pattern:** Jest/Vitest + Testing Library (hành vi UI, không test implementation detail); integration test route handler Next; mock Supabase/Redis/OpenAI khi cần.
- **Tổ chức file:** `Component.test.tsx` cạnh component; `route.test.ts` cạnh API; `e2e/*.spec.ts`.
- **Tránh:** selector giòn; test phụ thuộc lẫn nhau; assert state nội bộ thay vì UI.
- **Tiêu chí thành công:** coverage, toàn bộ pass, E2E cho luồng quan trọng, test nhanh.

---

## 2. Quản lý cơ sở dữ liệu (migrations)

### Từ database-migrations

- **Khi dùng:** đổi schema, index, migration dữ liệu, zero-downtime, thiết lập tool migrate.
- **Nguyên tắc:** mọi thay đổi qua migration; production **forward-only** (rollback = migration mới); tách DDL và DML; test trên dữ liệu gần production; **không sửa** migration đã chạy production.
- **Checklist:** có up/down hoặc ghi rõ không thể revert; tránh lock bảng lớn; cột mới nullable hoặc có default; index lớn dùng `CONCURRENTLY` (PostgreSQL); backfill tách file migration.
- **PostgreSQL:** thêm cột an toàn; `CREATE INDEX CONCURRENTLY`; rename/đổi cột theo **expand–contract**; xóa cột sau khi app không còn dùng; batch update với `LIMIT`/`SKIP LOCKED`.
- **Tool:** Prisma (`migrate dev` / `deploy`, SQL tùy chỉnh cho CONCURRENTLY), Drizzle (`generate`/`migrate`), Kysely (`migrate make` + `Migrator`), Django (`makemigrations`, `RunPython`, `SeparateDatabaseAndState`), golang-migrate (file `.up.sql`/`.down.sql`).
- **Zero-downtime:** expand → backfill → đọc/ghi mới → contract → drop cột cũ; có timeline ví dụ theo ngày.
- **Anti-pattern:** sửa tay DB production; sửa file migration đã deploy; `NOT NULL` không default trên bảng lớn; index blocking trên bảng lớn; xóa cột trước khi gỡ code.

---

## 3. Phát triển backend

### Từ backend-patterns

- **Khi dùng:** thiết kế REST/GraphQL, layer repo/service, tối ưu query, cache, job nền, middleware, validation/lỗi.
- **REST:** resource URL rõ ràng; filter/sort/pagination bằng query.
- **Repository:** interface + implementation (ví dụ Supabase) — tách truy vấn khỏi business.
- **Service:** logic nghiệp vụ gọi repo (search, vector, v.v.).
- **Middleware:** auth bọc handler Next API; gắn `req.user` sau verify.
- **DB:** chọn cột cần thiết; tránh N+1 (batch fetch + map); transaction qua RPC/Postgres function khi cần atomic.
- **Cache:** Redis cache-aside, TTL, invalidate khi update.
- **Lỗi:** class `ApiError`, handler tập trung, phân biệt Zod vs 500; retry exponential backoff cho gọi ngoài.
- **Auth:** JWT verify, RBAC với `requirePermission`.
- **Rate limit:** in-memory đơn giản theo IP (hoặc Redis trong production).
- **Job:** queue đơn giản trong process cho tác vụ không chặn request.
- **Logging:** JSON có `requestId`, level, không log secret.

---

## Ghi chú sử dụng trong Cursor

Có thể tách các mục trên thành rule trong `.cursor/rules/` hoặc skill riêng; khi làm việc với test DB/backend trong repo **PriceCheck**, ưu tiên khớp stack hiện tại (Next.js, Express, Supabase, Playwright nếu có).

---

*File được tạo tự động từ nội dung upstream ECC; giữ nguyên ý kỹ thuật, rút gọn và nhóm theo chủ đề.*
