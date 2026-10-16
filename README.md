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

## 31. Google AdSense

Quảng cáo tự động sử dụng Google AdSense Auto ads với publisher `pub-8299349376566920`. Mã và phạm vi khởi tạo được cấu hình tại `src/config/advertising.ts`; `public/ads.txt` cho phép Google phân phối quảng cáo cho publisher này. Không cần thêm mã đơn vị quảng cáo riêng.

Sau khi deploy, kiểm tra `/ads.txt`, rồi mở [cài đặt quảng cáo của website](https://adsense.google.com/adsense/u/0/pub-8299349376566920/myads/sites/preview?url=deal-hay.vercel.app), bật Auto ads và chọn Apply to site nếu chưa bật. Vị trí và số lượng quảng cáo do cài đặt Auto ads quyết định; một mã tích hợp có thể hiển thị nhiều quảng cáo. Xem [hướng dẫn của Google](https://support.google.com/adsense/answer/9261307?hl=vi).

Mã chỉ khởi tạo trên trang chủ, gian hàng và chi tiết sản phẩm. Vì script đã tải có thể tiếp tục hoạt động sau khi điều hướng trong ứng dụng, hãy cấu hình Page exclusions trong AdSense cho các trang tài khoản, đăng nhập, quản trị, tin nhắn và đặt hàng để giữ phạm vi hiển thị này.

## 32. Nhiệm vụ nhận mã giảm giá

Khi nguồn nhiệm vụ đã được cấu hình và kích hoạt, người dùng có thể mở trang nhiệm vụ từ hộp đặt hàng. Mỗi mốc nhiệm vụ có doanh thu được nhà cung cấp xác nhận sẽ cấp một mã giảm giá cố định, mặc định **1.000đ**, gắn với tài khoản và sản phẩm đã chọn. Mã được lưu vào kho mã để người dùng áp dụng khi đặt hàng. Thao tác mở tab, quay lại trang hay thời gian chờ không tự cấp mã.

Frontend gọi trực tiếp Laravel qua Server Actions để đọc trạng thái, tạo phiên và kiểm tra mã sau khi người dùng quay lại. Khóa xác minh AdGem chỉ nằm ở backend. Khi backend chưa được cấu hình, giao diện thông báo nhiệm vụ đang được chuẩn bị; người dùng vẫn đặt hàng bình thường.

Tài khoản hiện tại sử dụng Adsterra Publisher với SmartLink/Direct Link và quảng cáo thông thường. Cấu hình mặc định `REWARDED_TASK_PROVIDER=adsterra` giữ tính năng nhận mã chưa kích hoạt vì chưa có tích hợp xác nhận hoàn thành nhiệm vụ cho nguồn này. Không dùng thống kê lượt mở hoặc click làm xác nhận nhiệm vụ.

Adapter đã chuẩn bị cho AdGem Web Offerwall là lựa chọn riêng, chỉ kích hoạt khi có tài khoản và Property **Desktop/Web** được phê duyệt cho `deal-hay.vercel.app`, cùng mô hình phần thưởng đã khai báo. Chọn `REWARDED_TASK_PROVIDER=adgem`, cấu hình App ID, khóa Postback và endpoint `/api/postbacks/adgem/v3` trên backend theo hướng dẫn triển khai backend. Cần cấu hình Postback v3 trả về đầy đủ `player_id`, `app_id`, `conversion_id`, `goal_id`, `conversion_type`, `payout`, `c1` và `c2`. Backend kiểm tra chữ ký trên nội dung POST, đối chiếu phiên và chỉ cấp mã một lần cho một chuyển đổi hợp lệ. Chạy migration backend trước khi triển khai frontend.

Offerwall do AdGem hiển thị thường niêm yết điểm thưởng theo doanh thu và hệ số quy đổi của tài khoản. Một hệ số chung không bảo đảm mọi nhiệm vụ đều hiển thị đúng một mã 1.000đ. Trước khi mở adapter này, cần thống nhất cách hiển thị và trao thưởng cố định với AdGem, hoặc triển khai danh sách nhiệm vụ riêng hiển thị đúng phần thưởng qua Offer API. Việc nhập App ID và khóa chưa đủ để xác nhận phần thưởng trên trang đối tác đã khớp với coupon của Deal Hay.

Backend mặc định giữ `ADGEM_REWARD_MAPPING_CONFIRMED=false`; chỉ đặt thành `true` sau khi cách hiển thị và trao thưởng đã khớp với mô hình trên.

Mức 1.000đ là ngân sách giảm giá của website. Doanh thu trong callback là doanh thu chuyển đổi do nhà cung cấp ghi nhận, có thể bị điều chỉnh và chưa phải tiền đã được thanh toán. Theo dõi bảng điều khiển AdGem và mức chiết khấu để đối soát thực tế. Xem [Web Offerwall](https://docs.adgem.com/docs/integrate/offer-delivery/pre-built/web-offerwall) và [Postback v3](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v3).
