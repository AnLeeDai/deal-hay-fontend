## Next.js Development Rules

Phát triển project theo hướng **Server-First Architecture**, áp dụng tối đa các nguyên lý và best practices chính thức của Next.js App Router.

Next.js documentation:

https://nextjs.org/docs

UI components:

https://ui.shadcn.com/docs/components

---

## 1. Kiến trúc tổng thể

Frontend sử dụng **Next.js App Router react hook form validate form**.

Backend là một API độc lập được viết bằng **Laravel**.

Next.js frontend gọi **trực tiếp Laravel Backend API**.

Không xây dựng thêm proxy API bằng:

```text
app/api/*
```

hoặc Next.js Route Handler chỉ để forward request sang Laravel.

Ngoại lệ có phạm vi cố định: `/api/live/[...path]` phục vụ tin nhắn, thông báo, heartbeat, số chưa đọc và chuẩn bị từng ảnh upload. Các yêu cầu này cần chạy song song, không chờ hàng đợi Server Action của trình duyệt. Route chỉ cho phép các cặp đường dẫn/phương thức được liệt kê trong mã, lấy token từ cookie HttpOnly trên server, kiểm tra cùng origin và truyền body dạng stream; trình duyệt không nhận token. Đọc trang và các nghiệp vụ khác vẫn dùng API layer/Server Actions như bên dưới. Các route xác thực WebSocket và tải tệp chat cũng thuộc nhóm ngoại lệ theo tính năng.

Luồng dữ liệu chuẩn:

```text
Browser
   ↓
Next.js Server Component
   ↓
Module Container
   ↓
API Layer
   ↓
Laravel Backend API
```

Đối với mutation:

```text
Client interaction
   ↓
Server Action
   ↓
API Layer
   ↓
Laravel Backend API
```

Next.js không đóng vai trò API Gateway hoặc proxy cho Laravel.

---

## 2. Server-First Architecture

Ưu tiên tối đa xử lý phía server.

Mặc định component phải là **Server Component**.

Ưu tiên sử dụng:

- Server Components
- Server-side data fetching
- Server Actions
- server-side validation
- server-side data transformation
- caching
- revalidation
- Suspense / streaming khi phù hợp

Chỉ sử dụng:

```ts
"use client";
```

khi thực sự bắt buộc.

Ví dụ:

- `useState`
- `useEffect`
- `useRef`
- `onClick`
- `onChange`
- browser APIs
- client-only library
- interactive UI bắt buộc chạy trong browser

Không thêm `"use client"` vào:

- `page.tsx`
- `layout.tsx`
- container
- toàn bộ module

chỉ vì một component con cần interaction.

Luôn đẩy Client Component xuống boundary nhỏ nhất có thể.

Ví dụ:

```text
ArticlePage           Server
      ↓
ArticleContainer      Server
      ↓
ArticleCard           Server
      ↓
ArticleActions        Client
```

Chỉ `ArticleActions` sử dụng `"use client"`.

---

## 3. Data Fetching

Toàn bộ initial data phải được fetch từ phía server.

Không fetch initial data bằng:

- `useEffect`
- client-side `fetch`
- client-side Axios
- TanStack Query / React Query

nếu Server Component có thể thực hiện.

Ví dụ:

```tsx
export async function ArticleListContainer() {
  const articles = await getArticles();

  return <ArticleList articles={articles} />;
}
```

Trong đó:

```text
getArticles()
      ↓
Laravel Backend API
```

Laravel API được gọi trực tiếp từ Next.js server.

Không đi qua:

```text
/api/articles
```

của Next.js.

---

## 4. Mutation

Các request:

- POST
- PUT
- PATCH
- DELETE

ưu tiên thực hiện thông qua **Server Actions**.

Ví dụ:

```text
Form
 ↓
Server Action
 ↓
api/articles/mutations.ts
 ↓
Laravel API
```

Sau mutation sử dụng khi phù hợp:

```ts
revalidatePath();
revalidateTag();
redirect();
```

Không chuyển toàn bộ page/container thành Client Component chỉ để submit dữ liệu.

---

## 5. Folder Structure

Sử dụng cấu trúc:

```text
src/
├── app/
├── modules/
├── api/
├── components/
├── config/
├── lib/
└── types/
```

---

## 6. `app/`

`app/` chỉ chịu trách nhiệm chính cho:

- routing
- pages
- layouts
- metadata
- loading
- error boundaries
- not-found
- route-level composition

Ví dụ:

```text
app/
├── articles/
│   ├── page.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   │
│   └── [id]/
│       └── page.tsx
│
└── layout.tsx
```

Không đặt business logic lớn trong `page.tsx`.

Page chủ yếu gọi container:

```tsx
import { ArticleListContainer } from "@/modules/articles/containers/article-list-container";

export default function ArticlesPage() {
  return <ArticleListContainer />;
}
```

Không sử dụng:

```text
app/api/*
```

để proxy Laravel API.

Chỉ tạo Route Handler nếu một feature thực sự yêu cầu endpoint thuộc riêng Next.js và không phải proxy backend.

---

## 7. `modules/`

Mỗi feature chia thành một module riêng.

Ví dụ:

```text
modules/
└── articles/
    ├── containers/
    │   ├── article-list-container.tsx
    │   └── article-detail-container.tsx
    │
    ├── components/
    │   ├── article-list.tsx
    │   ├── article-card.tsx
    │   └── article-actions.tsx
    │
    ├── actions/
    │   ├── create-article.ts
    │   ├── update-article.ts
    │   └── delete-article.ts
    │
    ├── schemas/
    │   └── article.schema.ts
    │
    └── utils/
```

---

## 8. Container

Container chịu trách nhiệm:

- gọi API layer
- orchestration
- business logic
- chuẩn bị dữ liệu
- transform dữ liệu
- ghép các component nhỏ
- xử lý dữ liệu trước khi truyền xuống UI

Container mặc định là Server Component.

Ví dụ:

```tsx
export async function ArticleListContainer() {
  const articles = await getArticles();

  return <ArticleList articles={articles} />;
}
```

Không thêm `"use client"` vào container nếu không thực sự bắt buộc.

---

## 9. Component

Component bên trong module chủ yếu chịu trách nhiệm presentation.

Ví dụ:

```text
ArticleListContainer
        ↓
ArticleList
        ↓
ArticleCard
```

Không fetch backend API trong presentational component.

Không để nhiều child component tự fetch cùng một resource nếu container có thể fetch một lần và truyền xuống qua props.

---

## 10. API Layer

Tất cả giao tiếp với Laravel Backend API phải nằm trong:

```text
api/
```

Ví dụ:

```text
api/
├── articles/
│   ├── routes.ts
│   ├── queries.ts
│   ├── mutations.ts
│   └── types.ts
│
├── categories/
│   ├── routes.ts
│   ├── queries.ts
│   ├── mutations.ts
│   └── types.ts
│
└── users/
    ├── routes.ts
    ├── queries.ts
    ├── mutations.ts
    └── types.ts
```

Folder `api/` ở đây là **API client layer của frontend**, không phải Next.js API Route.

---

## 11. `routes.ts`

`routes.ts` chỉ định nghĩa endpoint của Laravel Backend API.

Ví dụ:

```ts
export const articleRoutes = {
  list: "/articles",
  detail: (id: string) => `/articles/${id}`,
  create: "/articles",
  update: (id: string) => `/articles/${id}`,
  delete: (id: string) => `/articles/${id}`,
};
```

Không hardcode endpoint Laravel rải rác trong project.

---

## 12. `queries.ts`

Chứa các request đọc dữ liệu:

```text
GET
```

Ví dụ:

```ts
export async function getArticles() {}

export async function getArticleById(id: string) {}
```

Các function này gọi trực tiếp Laravel Backend API.

Ưu tiên chỉ sử dụng chúng từ Server Component, container hoặc server-side logic.

---

## 13. `mutations.ts`

Chứa:

```text
POST
PUT
PATCH
DELETE
```

Ví dụ:

```ts
export async function createArticle() {}

export async function updateArticle() {}

export async function deleteArticle() {}
```

Các function gọi trực tiếp Laravel API.

Không đặt request logic trực tiếp trong UI component.

---

## 14. `types.ts`

Định nghĩa chính xác request/response type của Laravel API.

Ví dụ:

```ts
export interface Article {
  id: string;
  attributes: ArticleAttributes;
}

export interface ArticleAttributes {
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}
```

Không sử dụng:

```ts
any
```

Không tự suy đoán response nếu backend contract đã tồn tại.

---

## 15. Environment Variables

Mọi configuration phải được đưa vào:

```text
.env
.env.local
```

Không hardcode:

- Laravel API URL
- backend URL
- application URL
- API key
- secret
- authentication configuration
- third-party URL
- configuration theo environment

Ví dụ:

```env
NEXT_PUBLIC_API=http://localhost:8000/api
```

API layer sử dụng:

```ts
process.env.NEXT_PUBLIC_API
```

Không viết:

```ts
fetch("http://localhost:8000/api/articles");
```

---

## 16. `.env` và `.env.local`

`.env`:

Dùng cho configuration chung nếu phù hợp.

`.env.local`:

Dùng cho:

- local configuration
- secrets
- API keys
- token
- environment-specific configuration

`.env.local` không được commit lên repository.

---

## 17. Không expose backend config xuống browser

Data fetching chạy server-side. Cấu hình Laravel Backend URL hiện dùng `NEXT_PUBLIC_API` và module `config/env.ts` được bảo vệ bằng `server-only`.

Ví dụ:

```env
NEXT_PUBLIC_API=http://localhost:8000/api
```

Prefix `NEXT_PUBLIC_` khiến Next.js thay giá trị trực tiếp vào mã khi build. URL này không được chứa secret. Khi đổi URL phải build và deploy lại; không import module `config/env.ts` vào Client Component.

Ưu tiên để request xảy ra:

```text
Next.js Server
      ↓
Laravel API
```

thay vì:

```text
Browser
      ↓
Laravel API
```

để giữ kiến trúc Server-First.

---

## 18. Centralized Environment Config

Không sử dụng `process.env` rải rác toàn project.

Tạo:

```text
config/
└── env.ts
```

Ví dụ:

```ts
import "server-only";

export const env = {
  backendApiUrl: process.env.NEXT_PUBLIC_API!,
};
```

Sau đó API layer sử dụng:

```ts
import { env } from "@/config/env";
```

---

## 19. Server-only

Những module chứa:

- Laravel backend URL
- secrets
- token
- authentication server logic
- private environment variables

nên sử dụng:

```ts
import "server-only";
```

khi phù hợp.

Không import các module server-only vào Client Component.

---

## 20. shadcn/ui

Toàn bộ UI/UX phải ưu tiên component chính thức từ:

https://ui.shadcn.com/docs/components

Nếu shadcn/ui đã có component tương ứng thì phải sử dụng component đó.

Ví dụ:

- Button
- Card
- Input
- Form
- Dialog
- Alert Dialog
- Dropdown Menu
- Select
- Table
- Tabs
- Sheet
- Badge
- Pagination
- Skeleton
- Breadcrumb

Nếu component chưa được cài trong project thì cài bằng shadcn CLI.

Ví dụ:

```bash
npx shadcn@latest add button
```

Không tự tạo component thay thế nếu shadcn/ui đã có.

---

## 21. Styling

Tuyệt đối hạn chế custom CSS.

Không tự ý:

- đổi màu
- thêm gradient
- custom shadow
- thay border radius
- thay typography
- custom animation
- override CSS
- tạo custom variant
- redesign shadcn/ui

nếu task không yêu cầu rõ ràng.

UI phải giữ nguyên design language của shadcn/ui.

---

## 22. Tailwind CSS

Tailwind chỉ chủ yếu dùng cho layout/composition như:

- flex
- grid
- gap
- spacing layout
- width
- height
- responsive
- positioning
- alignment

Ví dụ:

```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
```

Không sử dụng Tailwind để tự redesign shadcn component.

---

## 23. Shared Components

```text
components/
├── ui/
├── layout/
└── shared/
```

`components/ui/` chứa các component được shadcn CLI sinh ra.

Ví dụ:

```text
components/ui/button.tsx
components/ui/card.tsx
components/ui/dialog.tsx
```

Business-specific component không được đặt trong `components/ui`.

Ví dụ:

```text
ArticleCard
```

phải nằm trong:

```text
modules/articles/components/article-card.tsx
```

---

## 24. Client Component Rules

Client Component phải nhỏ nhất có thể.

Không biến component thành Client Component chỉ để:

- fetch data
- map array
- format dữ liệu
- gọi helper
- conditional rendering
- xử lý business logic

Các việc trên ưu tiên xử lý server-side.

---

## 25. Forms

Ưu tiên:

```text
Form
 ↓
Server Action
 ↓
Validation
 ↓
API Mutation
 ↓
Laravel Backend
```

Nếu cần client-side validation hoặc interaction để cải thiện UX thì chỉ biến phần form cần thiết thành Client Component.

Laravel backend và server-side layer vẫn phải validate dữ liệu.

---

## 26. Next.js Native Features

Ưu tiên tận dụng:

- Server Components
- Server Actions
- `loading.tsx`
- `error.tsx`
- `not-found.tsx`
- Suspense
- streaming
- Metadata API
- `next/image`
- `next/font`
- `redirect`
- `notFound`
- `revalidatePath`
- `revalidateTag`
- caching

Không chuyển logic sang client nếu Next.js có giải pháp server-side phù hợp.

---

## 27. Architecture Priority

Khi có nhiều cách triển khai, ưu tiên:

```text
Server Component
       ↓
Server-side function
       ↓
API Layer
       ↓
Laravel Backend
```

Với mutation:

```text
Small Client Interaction
       ↓
Server Action
       ↓
API Layer
       ↓
Laravel Backend
```

Client-side là lựa chọn cuối cùng.

---

## 28. Restrictions

Không được tự ý:

- tạo Next.js API proxy cho Laravel
- tạo `app/api/*` chỉ để forward request
- fetch initial data từ browser
- thêm `"use client"` không cần thiết
- hardcode Laravel API URL
- hardcode API endpoint
- expose secret bằng `NEXT_PUBLIC_*`
- sử dụng `any`
- viết business logic trong UI component
- fetch API trong presentational component
- duplicate API logic
- redesign shadcn/ui
- custom CSS không cần thiết
- tạo custom component khi shadcn/ui đã có component tương ứng

---

## 29. Mục tiêu cuối cùng

Implementation phải hướng tới:

- Server-side tối đa
- Client-side tối thiểu
- JavaScript gửi xuống browser tối thiểu
- Next.js Server Component gọi trực tiếp Laravel Backend API
- không sử dụng Next.js làm proxy API
- API layer tập trung
- module-based architecture
- type-safe
- configuration qua `.env` / `.env.local`
- không hardcode
- không expose secret
- separation of concerns rõ ràng
- dễ maintain
- dễ scale
- tận dụng tối đa Next.js App Router
- giữ nguyên UI/UX của shadcn/ui

Nếu có nhiều giải pháp, luôn chọn giải pháp phù hợp nhất với **Server-First Architecture**.

---

## 30. Deploy trên Vercel

Import repository frontend vào Vercel và cấu hình biến sau trong Settings → Environment Variables cho môi trường Preview và Production:

```env
NEXT_PUBLIC_API=https://your-api-host.onrender.com/api
```

Tên biến phải đúng là `NEXT_PUBLIC_API`, giá trị là URL HTTP API của Laravel có hậu tố `/api`. Không dùng localhost trong Preview hoặc Production. `.env.local` chỉ cấu hình máy local và không được commit; nó không thiết lập biến cho Vercel. Vì giá trị `NEXT_PUBLIC_API` được thay vào mã khi build, sau khi sửa biến phải Redeploy để tạo deployment mới.

Trước khi deploy frontend, kiểm tra `GET https://your-api-host.onrender.com/api/` trả JSON trang chủ với HTTP 200. `/up` trả 200 chưa đủ để xác nhận Laravel API hoạt động: nếu nó trả `{"health":"OK"}` và `/api/*` trả `Not found.`, traffic có thể đang đi vào Laravel Reverb. Trên Render, chỉ HTTP server được nghe cổng công khai; Reverb phải nghe nội bộ và đi qua Caddy.

Nếu frontend nằm trong monorepo, đặt Vercel Root Directory là `deal-hay-fontend`. Build command và output directory giữ mặc định của Next.js.

## 31. Google AdSense và Google Ad Manager Rewarded Ads

Tài khoản Google AdSense dùng mã `ca-pub-7303400269186048`. Script do chủ website cung cấp được quản lý tại `src/config/advertising.ts` và chỉ tải một lần sau khi khách đồng ý cookie trên các trang mua sắm. Metadata chứa `google-adsense-account`; `public/ads.txt` được phục vụ tại `/ads.txt` với dòng:

`google.com, pub-7303400269186048, DIRECT, f08c47fec0942fa0`

AdSense và Google Ad Manager có cấu hình riêng. Script `adsbygoogle.js` và publisher ID không tạo vị trí quảng cáo có thưởng. Luồng miễn ship tải Google Publisher Tag (GPT) từ `https://securepubads.g.doubleclick.net/tag/js/gpt.js` khi khách chủ động chọn **Xem quảng cáo để nhận mã miễn ship**. Cần ad unit path thật do Google Ad Manager cấp; không dùng ID `ca-pub-...` hay mã quảng cáo mẫu để vận hành.

Lấy mã tại [Google Ad Manager](https://admanager.google.com/): **Inventory → Ad units → chọn/tạo ad unit → Tags → Google Publisher Tag**. Sao chép đường dẫn `/NETWORK_CODE/AD_UNIT_CODE` trong tag; nếu ad unit nằm trong cây phân cấp, giữ nguyên toàn bộ đường dẫn. Xem [hướng dẫn tạo tag](https://support.google.com/admanager/answer/177207?hl=en) và [cấu hình phân phối rewarded ads trên web](https://support.google.com/admanager/answer/9116812?hl=en). Tạo ad unit chưa đủ để đảm bảo có quảng cáo: cần cấu hình nguồn quảng cáo/line item phù hợp và website được chấp thuận. Trong backend, đặt:

```dotenv
SHIPPING_REWARDS_ENABLED=true
GOOGLE_AD_MANAGER_REWARDED_AD_UNIT_PATH=/YOUR_NETWORK_CODE/YOUR_REWARDED_AD_UNIT_CODE
```

Giá trị trên chỉ minh họa cấu trúc, phải thay bằng đường dẫn được cấp. Biến được đọc từ backend; frontend không cần biến môi trường mới. Khi thiếu/sai đường dẫn hoặc chương trình bị tắt, API trả ưu đãi chưa khả dụng và giao diện vẫn cho đặt hàng bình thường. Backend giữ mặc định tắt cho đến khi có ad unit thật. Chạy migration backend trước khi deploy frontend mới.

Cookie `deal-hay-advertising-consent` lưu `v2:accepted` hoặc `v2:declined` trong 180 ngày. Phiên bản v1 của quảng cáo cũ được hỏi lại vì nhà cung cấp đã đổi sang Google. Khách có thể đổi lựa chọn tại **Tùy chọn cookie quảng cáo**; rút lại đồng ý tải lại trang để dừng các script đã khởi tạo. Hai root layout tách trang mua sắm khỏi đăng nhập, tài khoản, quản trị và tin nhắn, kết thúc script quảng cáo khi chuyển nhóm trang. Cookie của website không thay thế Google-certified CMP tại những khu vực Google yêu cầu CMP.

Quảng cáo có thưởng chỉ phát mã khi GPT gửi `rewardedSlotGranted` cho đúng slot đã được mở. Đóng quảng cáo, phát xong video, nhấp quảng cáo hoặc chờ hết thời gian không tự phát mã. Các lỗi không có quảng cáo, trình duyệt không hỗ trợ, bị chặn hoặc quá thời gian tải đều có đường thử lại; khách vẫn có thể đặt hàng với phí vận chuyển thông thường. Nếu đã nhận sự kiện phần thưởng nhưng backend tạm lỗi, nút **Nhận lại mã miễn ship** thử lại phiên đó mà không bắt xem thêm quảng cáo.

**Giới hạn xác minh:** GPT web thông báo sự kiện ở trình duyệt. Payload `rewarded_slot_granted: true` là dữ liệu từ client, có thể bị giả mạo; đây không phải callback có chữ ký hoặc xác minh server-to-server từ Google. Backend kiểm tra đăng nhập, tài khoản/sản phẩm, cấu hình ad unit của phiên, hết hạn, giới hạn tần suất, cấp mã idempotent và mã dùng một lần. Nếu cần chứng minh lượt xem độc lập với client, phải bổ sung cơ chế xác minh được Google hỗ trợ cho tài khoản trước khi coi đây là xác minh chống gian lận đầy đủ. Xem [GPT rewarded sample](https://developers.google.com/publisher-tag/samples/display-rewarded-ad).

Theo [chính sách phần thưởng Google](https://support.google.com/admanager/answer/7496282?hl=en), miễn phí vận chuyển là ví dụ về phần thưởng gián tiếp được phép. Mã chỉ dùng trong Deal Hay, gắn tài khoản nhận và không chuyển nhượng. Giao diện nêu rõ phần thưởng, không yêu cầu nhấp nội dung quảng cáo và cho khách bỏ qua. Chỉ quảng cáo thuộc slot Rewarded được dùng để nhận mã; quảng cáo AdSense thông thường không được gắn với đổi thưởng. Chính sách tại `/privacy` và `/terms` đã cập nhật nhà cung cấp Google.

Chạy `npm run test:ads` để kiểm tra lựa chọn cookie, script singleton, cấu hình tài khoản và vòng đời rewarded ads; các kiểm thử mô phỏng GPT và không phát sinh quảng cáo thật.

## Upload ảnh trên cấu hình nhỏ và trang Độ trễ

Ảnh được thu nhỏ ngay trên trình duyệt, mỗi lần chỉ giải mã một ảnh và gửi tối đa hai ảnh đồng thời. Tiến độ dùng số byte thực của XHR, hiển thị theo từng ảnh và cả đợt; bước lưu nội dung được ghi riêng để tránh hiểu phần trăm gửi ảnh là đã lưu xong. Thumbnail được thu nhỏ trước khi hiển thị nhiều ảnh camera. Mỗi sản phẩm vẫn tối đa 50 ảnh bổ sung, mỗi ảnh gốc tối đa 30 MB; giới hạn tổng payload áp dụng sau chuẩn hóa.

Liên kết **Độ trễ** trên header/menu mobile mở `/diagnostics` sau khi đăng nhập. Trang đo kết nối có nút bắt đầu dạng vòng tròn, tiến độ kết nối → ping → tải xuống → tải lên, tốc độ Mbps trực tiếp và biểu đồ từ mẫu đo thực. Có thể dừng, đo lại và xem kết quả tạm thời khi lượt đo chưa hoàn tất. Không polling hoặc truyền dữ liệu đo trước khi người dùng bắt đầu.

Server action đọc token từ cookie HTTP-only và gọi `POST /api/diagnostics/speedtest/session` để đổi lấy token chỉ dùng cho lượt đo, hết hạn sau 120 giây. Trình duyệt dùng token này để gửi mẫu trực tiếp đến `/ping`, `/download` và `/upload` trên API; token tài khoản không được trả về trình duyệt. Đường truyền đo không đi qua Next.js, thời gian tạo phiên được tách khỏi số đo. Backend có các endpoint này phải được triển khai cùng frontend; `NEXT_PUBLIC_API` phải là địa chỉ API mà trình duyệt truy cập được, với origin frontend trong `CORS_ALLOWED_ORIGINS`.

Ping là trung vị của 7 yêu cầu HTTP sau một lượt làm nóng kết nối, gồm cả xử lý ứng dụng. Jitter là trung bình chênh lệch tuyệt đối giữa các mẫu ping liên tiếp. Mỗi chiều truyền 6 mẫu với kích thước tự điều chỉnh, tối đa 4 MiB/mẫu tải xuống và 2 MiB/mẫu tải lên. Tốc độ trung bình tính theo tổng byte chia tổng thời gian truyền; upload chỉ được ghi nhận sau khi server xác nhận đủ byte. Tổng payload thực tế tối đa 36 MiB/lượt, giao diện thông báo khoảng 40 MiB trước khi bắt đầu. Mẫu dùng dữ liệu ngẫu nhiên, không cache; server đọc rồi bỏ payload upload, không lưu vào DB/R2.

Endpoint `GET /api/diagnostics` và action đo dịch vụ cũ vẫn được giữ để tương thích. Phép đo mạng trên giao diện không chạy các kiểm tra database, cache, R2 hoặc Reverb.

Kiểm tra bằng `npm run test:speedtest`, `npm run test:image-upload`, `npm run typecheck` và `npm run build`.

## 32. Phí vận chuyển Hà Nội

Chủ shop cấu hình tại **Kênh người bán → Cửa hàng → Phí vận chuyển Hà Nội**. Có thể nhập phí mặc định và mức riêng cho từng phường/xã; mức riêng thay thế phí mặc định. Tính năng mặc định tắt và chỉ tính phí sau khi shop lưu cấu hình, bật áp dụng.

Khi khách chọn địa chỉ đặt hàng, frontend lấy báo phí từ backend theo sản phẩm và phường/xã. Địa chỉ Hà Nội dùng mức phí shop đã bật. Với địa chỉ ngoài Hà Nội hoặc shop chưa cấu hình, giao diện ghi rõ phí cần trao đổi với shop và chỉ hiển thị tiền hàng sau giảm. Phí được cộng riêng với tiền hàng; mã giảm giá sản phẩm hiện có tiếp tục chỉ giảm tiền hàng. Nếu phí đổi trước khi đặt, backend yêu cầu tải lại báo phí thay vì âm thầm tính giá khác.

Nút **Đặt hàng** mở trang riêng tại `/shops/[shopUserCode]/products/[productSlug]/checkout`, giữ phân loại đang chọn qua `variant_id`. Trang chia thành sản phẩm, thông tin giao hàng, ưu đãi và bảng tổng tiền; bảng tổng tiền cố định khi cuộn trên máy tính và nằm sau biểu mẫu trên điện thoại. Liên kết từ kho mã đi thẳng tới trang này; liên kết sản phẩm cũ có `discount_code` tự chuyển hướng và giữ mã. Sau khi đặt thành công, trang hiển thị mã đơn và tổng tiền do backend xác nhận.

Phần ưu đãi có ô nhập mã sản phẩm và nút **Khám phá ưu đãi miễn phí vận chuyển**. Mã sản phẩm nhập phải thuộc tài khoản và sản phẩm đang đặt; mã chưa lưu được lưu qua API trước khi chọn.

Khi backend bật `SHIPPING_REWARDS_ENABLED=true`, cấu hình `GOOGLE_AD_MANAGER_REWARDED_AD_UNIT_PATH` hợp lệ và shop đã bật phí giao hàng, **Khám phá ưu đãi miễn phí vận chuyển** mở lựa chọn quảng cáo có thưởng Google ngay trong trang đặt hàng. Khách đồng ý cookie, chủ động chọn xem rồi nhận mã khi GPT phát sự kiện cấp thưởng. Chỉ mở khu vực ưu đãi chưa tạo phiên hay cấp mã. Backend ghi nhà cung cấp/ad unit khi bắt đầu phiên và từ chối phiên cũ hoặc cấu hình đã thay đổi; mã đã cấp được phát lại idempotent khi thử lại yêu cầu. Xem mục 31 để cấu hình và hiểu giới hạn xác minh của GPT web.

Mã giảm 100% phí ship được lưu theo tài khoản và sản phẩm, tự khôi phục khi mở lại trang đặt hàng, mặc định hết hạn sau 7 ngày. Mã dùng một lần cho phí giao hàng Hà Nội do shop báo; phí bằng 0 hoặc chưa xác định thì giữ mã. Khách có thể bỏ chọn mã và kết hợp với mã giảm tiền hàng. Backend xác thực mã và tính tổng, chống dùng lại hoặc cấp trùng khi thử lại yêu cầu.

Chạy migration backend trước khi triển khai frontend mới: `php artisan migrate --force`. Kiểm tra báo phí, cấu hình và checkout bằng `node --test tests/public-shipping-quote.test.mjs tests/shop-shipping-settings.test.mjs tests/discount-code-actions.test.mjs tests/shipping-reward-actions.test.mjs`.
